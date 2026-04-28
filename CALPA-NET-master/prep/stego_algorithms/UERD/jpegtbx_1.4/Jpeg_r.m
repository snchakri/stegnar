function [bmp] = Jpeg_r(input_name)

img = jpeg_read(input_name);
dct = img.coef_arrays{1};
Q_tab = img.quant_tables{1};
Dct = dequantize(dct,Q_tab);
bmp = ibdct(Dct);
bmp = bmp + 128;
bmp = uint8(bmp);
end

