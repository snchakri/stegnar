% function Jpeg_w(input_img,ouput_img,QF)
function Jpeg_w(img,ouput_img,QF)
load default_gray_jpeg_obj;
quan_table=jpeg_qtable(QF);
default_gray_jpeg_obj.quant_tables{1} = quan_table;

% img = imread(input_img);
jpg_dct = bdct(double(img)-128);
jpg_dct = quantize(jpg_dct,quan_table);
jpg_dct = round(jpg_dct);
[img_h img_w] = size(jpg_dct);
default_gray_jpeg_obj.image_width = img_w;
default_gray_jpeg_obj.image_height = img_h;
default_gray_jpeg_obj.coef_arrays{1} = jpg_dct;
jpeg_write(default_gray_jpeg_obj,ouput_img);

end

