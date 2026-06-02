import os
from multiprocessing import Pool
from multiprocessing import Process, Manager, Lock
import glob
import subprocess


def generate_stego_images(cover_path, stego_path_set, alpha, idx, offset_unit):
    offset = idx * offset_unit
    line_counter = 0

    for cover_image in sorted(glob.glob(cover_path + '/*.jpg')):
        if (line_counter < offset):
            line_counter += 1
            continue
        if (line_counter >= offset + offset_unit):
            break
        (_, image_name) = os.path.split(cover_image)
        if (os.path.exists(os.path.join(stego_path_set[0], image_name)) == False):
            subprocess.call('./J-UNIWARD' + ' -i ' + cover_image + \
                            ' -O ' + stego_path_set[0] + ' -a %.2f ' % alpha + ' -r %u' % line_counter, shell=True)
            print
            image_name + " is copied to " + stego_path_set[0]
        else:
            print
            image_name + " is EXISTED in " + stego_path_set[0]

        line_counter += 1


cover_path_test = '/data1/dataset/wuwl/jpeg/cover_qf75_256/'
stego_path_set_test_20 = ['/data1/dataset/wuwl/jpeg/juniward20/']
p = Pool(10)
for i in range(10):
    p.apply_async(generate_stego_images, args=(cover_path_test, stego_path_set_test_20, 0.2, i, 1000))
print('Waiting for all subprocesses done...')
p.close()
p.join()
print('All subprocesses done.')
