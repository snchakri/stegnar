clc; clear all;

% set payload
payload =single(0.2);
currdir = pwd;

% load cover image
coverPath = fullfile('/data1/dataset/wuwl/spatial/cover/');

% output stego image
stegoPath = fullfile('/data1/dataset/wuwl/spatial/suniward20/');

cd(coverPath)
flist = dir('*.pgm');
cd(currdir)

for i = 1:length(flist)
    imname = flist(i).name;
    %if ~exist([sdir,imname],'file')
    %cover = imread([coverPath,imname]);
    stego = S_UNIWARD([coverPath,imname], payload);  
    imwrite(uint8(stego),[stegoPath,imname]);
 
end

fprintf('Embedding using Matlab file');
MEXstart = tic;
MEXend = toc(MEXstart);
fprintf(' - DONE')
