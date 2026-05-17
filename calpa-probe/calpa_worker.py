"""
calpa_worker.py  —  TF1 subprocess worker (copied into probe container)

Reads a JSON request from stdin:
  {
    "image_path": "/images/foo.png",
    "model_type":  "srnet",           // or "xunet"
    "model_path":  "/models/Model_438375.ckpt",
    "libs_path":   "/calpa/libs"
  }

Writes a JSON result to stdout:
  {
    "predicted_label": "CLEAN" | "STEGO",
    "confidence": 0.73,
    "raw_score": 1.12,
    "model_type": "srnet",
    "artifact_id": ""
  }

IMPORTANT: This file runs under the TF1 Python 3.7 interpreter.
"""

from __future__ import print_function

import json
import math
import os
import sys
import time
import numpy as np


def _load_image(image_path, np):
    """Load image as grayscale float32 [H, W, 1], normalised to [0, 1]."""
    try:
        from PIL import Image
        img = Image.open(image_path).convert('L')
        arr = np.array(img, dtype=np.float32) / 255.0
        return arr[:, :, np.newaxis]
    except ImportError:
        import matplotlib.image as mpimg
        arr = mpimg.imread(image_path)
        if arr.ndim == 3:
            arr = arr.mean(axis=2)
        return (arr.astype('float32') / 255.0)[:, :, None]


def _softmax2(logits):
    """Compute softmax over 2-class logit pair."""
    e0 = math.exp(logits[0])
    e1 = math.exp(logits[1])
    total = e0 + e1
    return e1 / total  # P(stego)


def _infer_srnet(image_path, model_path, libs_path, np):
    import tensorflow as tf

    # Inject libs so SRNet.py can find psm/setup_general_srnet.py
    srnet_lib = os.path.join(libs_path, 'srnet')
    psm_lib   = os.path.join(libs_path, 'psm')
    for p in [libs_path, srnet_lib, psm_lib]:
        if p not in sys.path:
            sys.path.insert(0, p)

    tf.reset_default_graph()

    img = _load_image(image_path, np)
    img_batch = img[np.newaxis, ...]   # [1, H, W, 1]

    ph_input = tf.placeholder(tf.float32, shape=[None, None, None, 1], name='ph_input')

    from SRNet import SRNet  # from libs/srnet/
    model = SRNet(False, 'NHWC')
    model._build_model(ph_input)

    saver = tf.train.Saver()
    config = tf.ConfigProto()
    config.gpu_options.allow_growth = True

    with tf.Session(config=config) as sess:
        sess.run(tf.global_variables_initializer())
        saver.restore(sess, model_path)
        logits = sess.run(
            tf.get_default_graph().get_tensor_by_name('ip/BiasAdd:0'),
            feed_dict={ph_input: img_batch}
        )

    p_stego = _softmax2(logits[0])
    label = 'STEGO' if p_stego >= 0.5 else 'CLEAN'
    return {
        'predicted_label': label,
        'confidence': float(p_stego),
        'raw_score': float(logits[0][1])
    }


def _infer_xunet(image_path, model_path, libs_path, np):
    import tensorflow as tf

    xunet_lib = os.path.join(libs_path, 'xunet') if os.path.isdir(os.path.join(libs_path, 'xunet')) else libs_path
    psm_lib   = os.path.join(libs_path, 'psm')
    for p in [libs_path, xunet_lib, psm_lib]:
        if p not in sys.path:
            sys.path.insert(0, p)

    tf.reset_default_graph()
    img = _load_image(image_path, np)
    img_batch = img[np.newaxis, ...]

    ph_input = tf.placeholder(tf.float32, shape=[None, None, None, 1], name='ph_input')

    from XuNet import XuNet  # from libs/srnet/ (also houses XuNet pattern)
    model = XuNet(False, 'NHWC')
    model._build_model(ph_input)

    saver = tf.train.Saver()
    config = tf.ConfigProto()
    config.gpu_options.allow_growth = True

    with tf.Session(config=config) as sess:
        sess.run(tf.global_variables_initializer())
        saver.restore(sess, model_path)
        logits = sess.run(
            tf.get_default_graph().get_tensor_by_name('ip/BiasAdd:0'),
            feed_dict={ph_input: img_batch}
        )

    p_stego = _softmax2(logits[0])
    label = 'STEGO' if p_stego >= 0.5 else 'CLEAN'
    return {
        'predicted_label': label,
        'confidence': float(p_stego),
        'raw_score': float(logits[0][1])
    }


def main():
    raw = sys.stdin.read().strip()
    try:
        req = json.loads(raw)
    except Exception as e:
        print(json.dumps({'error': 'invalid JSON: {}'.format(str(e))}))
        sys.exit(1)

    import numpy as np

    try:
        image_path = req['image_path']
        model_type = req.get('model_type', 'srnet')
        model_path = req['model_path']
        libs_path  = req.get('libs_path', '/calpa/libs')

        if model_type == 'srnet':
            result = _infer_srnet(image_path, model_path, libs_path, np)
        elif model_type == 'xunet':
            result = _infer_xunet(image_path, model_path, libs_path, np)
        else:
            raise ValueError('unknown model_type: {}'.format(model_type))

        result['model_type']  = model_type
        result['artifact_id'] = req.get('artifact_id', '')
        print(json.dumps(result))

    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)


if __name__ == '__main__':
    main()
