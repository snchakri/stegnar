payload = 0.2;
params.seed = 123; % Can be a random number
H = 0; % It use simulator for embedding if H=0 ，H=10时候发现对应的STC mex文件有错
currdir = pwd;
cdir = '/data1/dataset/wuwl/spatial/cover/';     % cover dir
sdir = '/data1/dataset/wuwl/spatial/hill20/';    % stego dir
cd(cdir)

flist = dir('*.pgm');

fprintf('totally counts:%s',length(flist));
cd(currdir)
for i = 1:length(flist)
    imname = flist(i).name;
    x = imread([cdir,imname]);
    cost = f_cal_cost(x);        % Obtain the costs for all pixels
    stego = f_embedding(x, cost, payload, H,params); % Embed the secret message
    imwrite(uint8(stego),[sdir,imname]); 
end    
