(() => {
  const form = document.getElementById('registerForm'); if (!form) return;
  const toast = document.getElementById('toast'); const registerView=document.getElementById('registerView'); const successView=document.getElementById('successView');
  const savedKey='boxcellink_saved_accounts';
  const t=(id)=>window.BoxI18n?.t(id)||id;
  const notify=(text,type='success')=>{ if(!toast)return; toast.className=`toast show ${type}`; toast.innerHTML=`<i class="fa-solid ${type==='success'?'fa-circle-check':'fa-circle-exclamation'}"></i><span>${text}</span>`; clearTimeout(window.__toast); window.__toast=setTimeout(()=>toast.classList.remove('show'),2000); };
  document.querySelectorAll('.password-toggle').forEach(btn=>btn.addEventListener('click',()=>{const input=document.getElementById(btn.dataset.target);const icon=btn.querySelector('i');const show=input.type==='password';input.type=show?'text':'password';icon.className=`fa-solid ${show?'fa-eye-slash':'fa-eye'}`;}));
  form.addEventListener('submit',async e=>{e.preventDefault();const submit=form.querySelector('button[type=submit]');submit.disabled=true;const original=submit.innerHTML;submit.textContent=t('creating');
    try{const name=form.elements.name.value.trim(),email=form.elements.email.value.trim().toLowerCase(),password=form.elements.password.value;const referralCode=(new URLSearchParams(location.search).get('ref')||'').trim().toUpperCase();const {error}=await window.sb.auth.signUp({email,password,options:{data:{full_name:name,referral_code:referralCode||null}}});if(error)throw error;
      const accounts=JSON.parse(localStorage.getItem(savedKey)||'[]').filter(a=>a.email!==email);accounts.unshift({name,email});localStorage.setItem(savedKey,JSON.stringify(accounts.slice(0,5)));
      document.getElementById('successName').textContent=name;document.getElementById('successEmail').textContent=email;document.getElementById('successPassword').textContent=password;document.getElementById('successPassword').dataset.value=password;
      registerView.hidden=true;successView.hidden=false;notify(t('successToast'),'success');
    }catch(err){notify(err.message||t('registerFailed'),'error');}finally{submit.disabled=false;submit.innerHTML=original;}
  });
  document.getElementById('successPasswordToggle')?.addEventListener('click',()=>{const el=document.getElementById('successPassword'),icon=document.querySelector('#successPasswordToggle i');const hidden=el.textContent==='••••••••';el.textContent=hidden?el.dataset.value:'••••••••';icon.className=`fa-solid ${hidden?'fa-eye-slash':'fa-eye'}`;});
  document.getElementById('goLogin')?.addEventListener('click',()=>{const email=document.getElementById('successEmail').textContent;localStorage.setItem('boxcellink_login_email',email);location.href='login.html';});
  document.getElementById('screenshotBtn')?.addEventListener('click',async()=>{try{const canvas=await html2canvas(document.getElementById('accountCard'),{backgroundColor:'#fffefa',scale:2});const a=document.createElement('a');a.download='BoxCellink-Akun.png';a.href=canvas.toDataURL('image/png');a.click();notify(t('screenshotSaved'),'success');}catch(e){notify(t('screenshotManual'),'error');}});
})();
