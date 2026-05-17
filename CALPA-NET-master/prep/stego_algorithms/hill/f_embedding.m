function stego = f_embedding(cover, costmat, payload, H,params)
if H==0
    stego= f_sim_embedding(cover,costmat,payload, params);
else
    stego = f_stc_embedding(cover, costmat, payload);
end