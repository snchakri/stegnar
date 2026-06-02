"""
====================================================================================================
  stegnar-mitm · calpa_worker.py — Enterprise-Grade TensorFlow Inference Worker for CALPA-NET
====================================================================================================

  THEORY & REFERENCE:
  ------------------
  Paper: "CALPA-NET: Channel-pruning-assisted Deep Residual Network for Steganalysis of Digital Images"
  Journal: IEEE Transactions on Information Forensics and Security (IEEE TIFS 2021).
  Authors: Standard CALPA-NET research team.

  ARCHITECTURAL DESIGN & PRUNING MECHANICS:
  ----------------------------------------
  CALPA-NET represents a milestone in high-speed, hardware-efficient convolutional steganalysis. 
  Traditional models like SRM (Spatial Rich Model) or base SRNet (18-layer CNN) are highly computationally
  prohibitive, making inline network sniffing impractical. CALPA-NET resolves this by applying two 
  distinct pruning algorithms to the base SRNet architecture:
  
    1. ThiNet Pruning (Layers 3..12): Uses data-driven channel selection based on the next layer's 
       reconstruction error to prune filter channels in residual layers.
    2. L1-norm Pruning (Layers 8..12): Prunes residual connections by keeping channels with the highest
       absolute sum of weights.

  This worker leverages a fully stateless inference graph that parses the pruning ratios directly
  from the `.cfg` file shipped alongside the model checkpoints. This decouples the network architecture 
  from the specific checkpoint weights, enabling developers and researchers around the world to load
  custom pruned weights seamlessly.

  DATA PROTOCOL (STDIN/STDOUT):
  ----------------------------
  - STDIN Input:  JSON string containing {"image_path": str, "model_path": str, "cfg_path": str}
  - STDOUT Output: JSON string containing:
      {
        "predicted_label": "CLEAN" | "STEGO",
        "confidence": float (P_stego probability),
        "raw_score": float (Logit bias),
        "device": str (Active execution hardware)
      }
  - Exit Code: Exits with status `1` on error and prints JSON containing the exception traceback.

  OPEN SOURCE COLLABORATION NOTE:
  ------------------------------
  This worker operates as a stateless subprocess inside the privileged `stegnar-mitm` container. 
  Feel free to contribute alternative models (e.g. PyTorch, ONNX, TensorRT) by implementing a matching
  JSON protocol handler.
====================================================================================================
"""

from __future__ import print_function

import json
import math
import os
import sys
import time

# ── Python 2/3 configparser compatibility ────────────────────────────────────
try:
    import ConfigParser as configparser  # Python 2
except ImportError:
    import configparser                  # Python 3


def _read_pruned_channels(cfg_path):
    """
    Parse the CALPA-NET .cfg file and return the number of channels
    to KEEP in each layer (i.e. 1 - prune_rate applied to base sizes).

    Base sizes per layer from original SRNet:
      L1=64, L2=16, L3-L7=16, L8-L11 see code, L12=512/512.

    Returns (thinet_keep, l1_keep) as lists indexed from layer 3 onward.
    """
    import os
    if not os.path.isfile(cfg_path):
        raise FileNotFoundError("Pruning config file not found: " + cfg_path)

    cfg = configparser.RawConfigParser()
    cfg.read(cfg_path)
    if not cfg.sections():
        raise ValueError("Config file is empty or invalid: " + cfg_path)

    # Thinet keep-rates for layers 3..12 (10 entries, index 0=L3, 9=L12)
    thinet_save = []
    for i in range(3, 13):
        rate = float(cfg.get('Thinet_rate', 'layer' + str(i)))
        thinet_save.append(1.0 - rate)

    # L1 keep-rates for layers 8..12 (5 entries, index 0=L8, 4=L12)
    l1_save = []
    for j in range(8, 13):
        rate = float(cfg.get('L1_rate', 'layer' + str(j)))
        l1_save.append(1.0 - rate)

    return thinet_save, l1_save


def _load_image(image_path):
    """
    Load a JPEG/PNG image as grayscale float32 [1, H, W, 1] (NHWC batch).
    SRNet expects single-channel images with raw pixel values in range [0, 255].
    """
    import numpy as np
    from PIL import Image
    img = Image.open(image_path).convert('L')  # greyscale
    arr = np.array(img, dtype=np.float32)
    return arr[None, :, :, None]  # [1, H, W, 1]



def _build_pruned_srnet(ph_input, thinet_save, l1_save):
    """
    Build the pruned SRNet graph and return the logits tensor 'ip/BiasAdd:0'.

    This is a direct port of SRNet_qf75_juniward_04_pruned_Ta05.py::SRNet_pruned
    but with NO dependency on setup files, generators, or queues.

    thinet_save[i] = fraction of channels kept by Thinet for layer (i+3).
    l1_save[j]     = fraction of channels kept by L1 for layer (j+8).
    """
    import tensorflow as tf
    from tensorflow.contrib import layers
    from tensorflow.contrib.framework import arg_scope

    data_format = 'NHWC'
    reduction_axis = [1, 2]  # spatial dims for NHWC global-avg-pool

    with arg_scope(
        [layers.conv2d],
        num_outputs=16, kernel_size=3, stride=1, padding='SAME',
        data_format=data_format, activation_fn=None,
        weights_initializer=layers.variance_scaling_initializer(),
        weights_regularizer=layers.l2_regularizer(2e-4),
        biases_initializer=tf.constant_initializer(0.2),
        biases_regularizer=None
    ), arg_scope(
        [layers.batch_norm],
        decay=0.9, center=True, scale=True,
        updates_collections=None, is_training=False,
        fused=True, data_format=data_format
    ), arg_scope(
        [layers.avg_pool2d],
        kernel_size=[3, 3], stride=[2, 2], padding='SAME',
        data_format=data_format
    ):
        # ── Type 1 layers (plain conv): L1, L2 ───────────────────────────────
        with tf.variable_scope('Layer1'):
            conv = layers.conv2d(ph_input, num_outputs=64, kernel_size=3)
            prev = tf.nn.relu(layers.batch_norm(conv))

        with tf.variable_scope('Layer2'):
            conv = layers.conv2d(prev)
            prev = tf.nn.relu(layers.batch_norm(conv))

        # ── Type 2 layers (residual, no spatial downscale): L3-L7 ────────────
        for i, layer_idx in enumerate(range(3, 8)):  # i=0..4, layer=3..7
            with tf.variable_scope('Layer' + str(layer_idx)):
                n = int(16 * thinet_save[i])           # thinet_save[0]=L3 … [4]=L7
                c1 = layers.conv2d(prev, num_outputs=n)
                a1 = tf.nn.relu(layers.batch_norm(c1))
                c2 = layers.conv2d(a1)                 # output back to 16
                bn = layers.batch_norm(c2)
                prev = tf.add(prev, bn)

        # ── Type 3 layers (residual + downscale): L8-L11 ─────────────────────
        # Base output sizes before pruning: L8=16, L9=64, L10=128, L11=256
        base_out = {8: 16, 9: 64, 10: 128, 11: 256}
        for j, layer_idx in enumerate(range(8, 12)):   # j=0..3, layer=8..11
            t_idx = layer_idx - 3                       # thinet_save index: L8→5, L9→6…
            out_ch = int(base_out[layer_idx] * l1_save[j])       # l1_save[0]=L8
            th_ch  = int(base_out[layer_idx] * thinet_save[t_idx])
            with tf.variable_scope('Layer' + str(layer_idx)):
                # shortcut branch
                convs = layers.conv2d(prev, num_outputs=out_ch, kernel_size=1, stride=2)
                convs = layers.batch_norm(convs)
                # main branch
                c1 = layers.conv2d(prev, num_outputs=th_ch)
                a1 = tf.nn.relu(layers.batch_norm(c1))
                c2 = layers.conv2d(a1, num_outputs=out_ch)
                bn = layers.batch_norm(c2)
                pool = layers.avg_pool2d(bn)
                prev = tf.add(convs, pool)

        # ── Type 4 layer (global avg-pool): L12 ──────────────────────────────
        with tf.variable_scope('Layer12'):
            th12 = int(512 * thinet_save[9])            # thinet_save[9]=L12
            l1_12 = int(512 * l1_save[4])               # l1_save[4]=L12
            c1 = layers.conv2d(prev, num_outputs=th12)
            a1 = tf.nn.relu(layers.batch_norm(c1))
            c2 = layers.conv2d(a1, num_outputs=l1_12)
            bn = layers.batch_norm(c2)
            avgp = tf.reduce_mean(bn, reduction_axis, keep_dims=True)

    # ── Fully-connected output head ───────────────────────────────────────────
    logits = layers.fully_connected(
        layers.flatten(avgp), num_outputs=2,
        activation_fn=None, normalizer_fn=None,
        weights_initializer=tf.random_normal_initializer(mean=0., stddev=0.01),
        biases_initializer=tf.constant_initializer(0.),
        scope='ip'
    )
    return logits


def _softmax2(logits):
    e0 = math.exp(logits[0])
    e1 = math.exp(logits[1])
    return e1 / (e0 + e1)   # P(stego)


def _detect_device():
    """
    Return '/GPU:0' if an NVIDIA GPU with CUDA is reachable, else '/CPU:0'.

    Resolution order:
      1. CALPA_DEVICE env var ("GPU" or "CPU") — explicit override.
      2. nvidia-smi probe — present means CUDA driver is installed.
      3. Default: CPU.

    NOTE: We always install tensorflow-gpu so both paths are always available.
    TF will log a warning (not an error) when /GPU:0 is requested but no
    CUDA device is found; allow_soft_placement re-routes ops to CPU silently.
    """
    import subprocess
    forced = os.environ.get('CALPA_DEVICE', '').strip().upper()
    if forced in ('GPU', 'CPU'):
        chosen = '/' + forced + ':0'
        print('[calpa_worker] Device override from CALPA_DEVICE: ' + chosen, file=sys.stderr)
        return chosen

    try:
        subprocess.check_output(['nvidia-smi'], stderr=subprocess.STDOUT)
        print('[calpa_worker] nvidia-smi found — using /GPU:0', file=sys.stderr)
        return '/GPU:0'
    except (FileNotFoundError, subprocess.CalledProcessError):
        print('[calpa_worker] No NVIDIA GPU detected — falling back to /CPU:0', file=sys.stderr)
        return '/CPU:0'


def run_inference(image_path, model_path, cfg_path, artifact_id='', threshold=0.70):
    import numpy as np
    import tensorflow as tf

    # 0. Device selection (GPU if available, CPU fallback)
    device = _detect_device()

    # 1. Parse pruning config
    thinet_save, l1_save = _read_pruned_channels(cfg_path)

    # 2. Load image
    img_batch = _load_image(image_path)  # [1, H, W, 1]

    # 3. Build graph on selected device
    tf.reset_default_graph()
    with tf.device(device):
        ph_input = tf.placeholder(tf.float32, shape=[None, None, None, 1], name='ph_input')
        logits_t = _build_pruned_srnet(ph_input, thinet_save, l1_save)

    # 4. Session config — allow TF to silently re-place ops if a device is unavailable
    tf_cfg = tf.ConfigProto()
    tf_cfg.gpu_options.allow_growth   = True   # don't grab all VRAM upfront
    tf_cfg.allow_soft_placement       = True   # fallback any op GPU can't run
    tf_cfg.log_device_placement       = False  # set True to debug placement

    # 5. Restore checkpoint and run inference
    saver = tf.train.Saver()
    with tf.Session(config=tf_cfg) as sess:
        sess.run(tf.global_variables_initializer())
        saver.restore(sess, model_path)
        logits = sess.run(logits_t, feed_dict={ph_input: img_batch})

    # 6. Decode output — use raw model inference
    p_stego = float(_softmax2(logits[0]))

    label = 'STEGO' if p_stego >= threshold else 'CLEAN'
    return {
        'predicted_label': label,
        'confidence':      p_stego,
        'raw_score':       float(logits[0][1]),
        'device':          device,   # report which device was used
    }


def main():
    raw = sys.stdin.read().strip()
    try:
        req = json.loads(raw)
    except Exception as e:
        print(json.dumps({'error': 'invalid JSON: ' + str(e)}))
        sys.exit(1)

    try:
        if 'cfg_path' not in req:
            raise ValueError("Invalid schema: 'cfg_path' missing. (Wrong worker script?)")

        image_path = req['image_path']
        model_path = req['model_path']
        cfg_path   = req['cfg_path']
        artifact_id = req.get('artifact_id', '')
        threshold  = req.get('threshold', 70) / 100.0

        t0     = time.time()
        result = run_inference(image_path, model_path, cfg_path, artifact_id, threshold)
        t1     = time.time()

        result['latency_ms']  = int((t1 - t0) * 1000)
        result['model_type']  = 'calpa_srnet_pruned'
        result['artifact_id'] = req.get('artifact_id', '')
        print(json.dumps(result))

    except Exception as e:
        import traceback
        print(json.dumps({'error': str(e), 'trace': traceback.format_exc()}))
        sys.exit(1)


if __name__ == '__main__':
    main()
