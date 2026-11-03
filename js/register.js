const msg=document.getElementById('message');const form=document.getElementById('loginForm')||document.getElementById('registerForm');
if(form&&form.id==='loginForm')form.onsubmit=async e=>{e.preventDefault();const {data,error}=await sb.auth.signInWithPassword({email:email.value,password:password.value});if(error){msg.textContent=error.message;return}const {data:p}=await sb.from('profiles').select('role').eq('id',data.user.id).single();location.href=p?.role==='admin'?'dashboard.html':'../index.html'};
if(form&&form.id==='registerForm')form.onsubmit=async e=>{
 e.preventDefault();
 const params=new URLSearchParams(location.search);
 const referralCode=(params.get('ref')||'').trim().toUpperCase();
 const {data,error}=await sb.auth.signUp({email:email.value,password:password.value,options:{data:{full_name:name.value,referral_code:referralCode||null}}});
 if(error){msg.textContent=error.message;return}
 msg.textContent='Akun dibuat. Jika email confirmation aktif, cek inbox lalu login.';
};
