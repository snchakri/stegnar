

This is a set of scripts used to complete the conversion of pictures from pgm (or other lossless format) to float mat files for steganography analysis input.


1、resize_compression.m complete the function of resize and JPEG compression.
   From pgm pictures to 256x256 JPEG format pictures. Compressed details such as QF can be set in.

   Use case: enter matlab into the matlab terminal in the server, and enter the following command
   a = resize_compression('/data1/dataset/XXX/Boss_BOWS2/','*.pgm','/data1/dataset/XXX/jpeg/cover_qf75_256/')
   or
   a = resize_compression('/data1/dataset/wuwl/Boss_BOWS2/','*.pgm','/data1/dataset/wuwl/psm_dataset/jpeg_domain/qf95/jpeg/cover/')

   identify -verbose xx.jpg can view the details of the jpeg image and see if quality is the target qf

2、Steganography（stego_steglogrithm）：
    Jpeg Steganography：
	    JUNIWARD method：run Jpegstego.py script
	    	modify cover_path_test and stego_path_set_test_20,That is, enter the original drawing folder and output the steganography folder.
	    	modify p.apply_async,The '0.2' parameter inside corresponds to the desired bpnzac

    	UERD method：run ./uerd implementation/J_UERD.m script
		    modify QFs, Corresponding to the required QF
		    modify CAPA, Corresponding to the required bpnzac
		    modify dirSource and output_dir, That is, enter the original drawing folder and output the steganography folder.


	Spatial Steganography：
	    Hill method：run example.m script
	         modify path，playload，Parameter H

	    SUNIWARD method: run matlab/use_suniward.m script
	         modify path，playload


3、Save .mat files in floats format（decompress_jpg）：
	run savetheMat.m script，Save JPEG image as .mat format.
	run dct_2_float_spatial.py script, Transfer the .mat file obtained from the previous step to the float type by quantization table and save it.
	The quantification table here should use the repmat_quant_file_2_size256.m script to repmat the quantitation table of 8x 8 to the size of 256x256.
    8x8 quantitation table: Every time you read an image with jpegread, there will be a corresponding quant_table, to save the quant_table directly.


4、Split dataset（Division）
    run split_dataset.py (Set the seed, path, scale) Get three folders, train... Text.. Val.. For subsequent establishment of datasets
    run create_dataset.py (Set the type, path) Get the target dataset.

