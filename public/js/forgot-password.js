(()=>{
 'use strict';
 const toast=document.getElementById('toast'),msg=document.getElementById('message');
 const requestView=document.getElementById('requestView'),resetView=document.getElementById('resetView'),successView=document.getElementById('successView');
 let activeEmail='';
 const notify=(text,type='success')=>{
   if(msg)msg.textContent=text;
   if(!toast)return;
   toast.className=`toast show ${type}`;toast.replaceChildren();
   const icon=document.createElement('i');icon.className=`fa-solid ${type==='success'?'fa-circle-check':'fa-circle-exclamation'}`;
   const label=document.createElement('span');label.textContent=String(text??'');toast.append(icon,label);
   window.clearTimeout(window.__toast);window.__toast=window.setTimeout(()=>toast.classList.remove('show'),3500);
 };
 const auth=()=>window.sb?.auth;
 const emailInput=document.getElementById('resetEmail');
 const sendOtp=async()=>{
   if(!auth()){notify('Koneksi Supabase belum tersedia. Periksa konfigurasi.','error');return false;}
   const email=(activeEmail||emailInput.value).trim().toLowerCase();
   if(!email){notify('Masukkan Gmail terdaftar terlebih dahulu.','error');return false;}
   const {error}=await auth().signInWithOtp({email,options:{shouldCreateUser:false}});
   if(error)throw error;
   activeEmail=email;
   document.getElementById('recoveryEmail').value=email;
   requestView.hidden=true;resetView.hidden=false;
   notify('Kode OTP dikirim jika Gmail terdaftar. Periksa Inbox dan folder Spam.');
   return true;
 };
 document.querySelectorAll('.password-toggle').forEach(btn=>btn.addEventListener('click',()=>{
   const input=document.getElementById(btn.dataset.target),icon=btn.querySelector('i');
   const show=input.type==='password';input.type=show?'text':'password';
   icon.className=`fa-solid ${show?'fa-eye-slash':'fa-eye'}`;
 }));
 document.getElementById('forgotForm')?.addEventListener('submit',async e=>{
   e.preventDefault();const button=e.currentTarget.querySelector('button[type=submit]');button.disabled=true;
   activeEmail=emailInput.value.trim().toLowerCase();
   try{await sendOtp();}catch(err){notify(err.message||'Gagal mengirim kode OTP.','error');}
   finally{button.disabled=false;}
 });
 document.getElementById('resendOtp')?.addEventListener('click',async e=>{
   const button=e.currentTarget;button.disabled=true;
   try{await sendOtp();}catch(err){notify(err.message||'Gagal mengirim ulang OTP.','error');}
   finally{button.disabled=false;}
 });
 document.getElementById('resetForm')?.addEventListener('submit',async e=>{
   e.preventDefault();
   if(!auth()){notify('Koneksi Supabase belum tersedia.','error');return;}
   const email=document.getElementById('recoveryEmail').value.trim().toLowerCase();
   const token=document.getElementById('resetOtp').value.trim();
   const password=document.getElementById('newPassword').value;
   const confirm=document.getElementById('confirmPassword').value;
   if(password.length<8){notify('Kata sandi minimal 8 karakter.','error');return;}
   if(password!==confirm){notify('Konfirmasi kata sandi tidak sama.','error');return;}
   if(!token){notify('Masukkan kode OTP dari email.','error');return;}
   const button=e.currentTarget.querySelector('button[type=submit]');button.disabled=true;
   try{
     const {error:verifyError}=await auth().verifyOtp({email,token,type:'email'});
     if(verifyError)throw verifyError;
     const {error:updateError}=await auth().updateUser({password});
     if(updateError)throw updateError;
     resetView.hidden=true;successView.hidden=false;
     notify('Kata sandi berhasil diperbarui. Silakan login kembali.');
     await auth().signOut({scope:'local'});
   }catch(err){notify(err.message||'Kode OTP tidak valid atau sudah kedaluwarsa.','error');}
   finally{button.disabled=false;}
 });
})();