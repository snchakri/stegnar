# @Time    : 2019-05-11 10:05
# @Author  : WeiLong Wu
# @File    : split_dataset.py
# @Function: split dataset


import os
import random

# 10000 images in the entire BOWS2 dataset
# + Randomly chosen 4000 images form BOSSbase     -- totally 14000 images for train

# 1000 BOSSbase images set for validation
# the remaining 5000 BOSSbase images for testing.

PSM_Input_Dir = 'qf75/seed123/juniward20'
Embedding_Algorithm = 'juniward20'


Cover_Path_Base = '/data1/dataset/wuwl/psm_dataset/jpeg_domain/qf75/jpeg-mat-floats/cover'
Stego_Path_Base = '/data1/dataset/wuwl/psm_dataset/jpeg_domain/qf75/jpeg-mat-floats/' + Embedding_Algorithm + '/'


def main():
    if not os.path.exists(PSM_Input_Dir):
        os.makedirs(PSM_Input_Dir)
    all = []
    image_name = os.listdir(Cover_Path_Base)
    all = all + image_name

    BOWS2 = all[:10000]  # That's for sure ，10000 images in the entire BOWS2 dataset
    BOSS = all[10000:]  # That's for sure

    key = range(len(BOSS))
    print
    key
    seed = random.seed('123')
    random.shuffle(BOSS, seed)

    s = int(len(BOSS) * 0.4)  # Randomly chosen 4000 images form BOSSbase
    s2 = s + int(len(BOSS) * 0.5)
    with open(PSM_Input_Dir + '/train_cover.txt', 'a') as f:
        for i in key[0:s]:
            f.write(Cover_Path_Base + BOSS[i] + '\n')  # Save the 4000 selected images
        for i in range(len(BOWS2)):
            f.write(Cover_Path_Base + BOWS2[i] + '\n')  # Save 10000 images in the entire BOWS2 dataset

    with open(PSM_Input_Dir + '/train_stego.txt', 'a') as f:
        for i in key[0:s]:
            f.write(Stego_Path_Base + BOSS[i] + '\n')
        for i in range(len(BOWS2)):
            f.write(Stego_Path_Base + BOWS2[i] + '\n')

    with open(PSM_Input_Dir + '/test_cover.txt', 'w') as f:
        for i in key[s:s2]:
            f.write(Cover_Path_Base + BOSS[i] + '\n')  # Save 5000 BOSSbase images for testing

    with open(PSM_Input_Dir + '/test_stego.txt', 'w') as f:
        for i in key[s:s2]:
            f.write(Stego_Path_Base + BOSS[i] + '\n')

    with open(PSM_Input_Dir + '/val_cover.txt', 'w') as f:
        for i in key[s2:]:
            f.write(Cover_Path_Base + BOSS[i] + '\n')  # Save 1000 BOSSbase images set for validation

    with open(PSM_Input_Dir + '/val_stego.txt', 'w') as f:
        for i in key[s2:]:
            f.write(Stego_Path_Base + BOSS[i] + '\n')


if __name__ == '__main__':
    main()
