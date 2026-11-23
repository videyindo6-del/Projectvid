(() => {
  'use strict';
  const mainBox = document.getElementById('refMain');
  const progressBox = document.getElementById('refProgress');
  const couponBox = document.getElementById('refCoupons');
  const rewardBox = document.getElementById('refRewards');
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[char]));
  const money = amount => 'Rp ' + Math.max(0, Number(amount) || 0).toLocaleString('id-ID');
  const dateLabel = (value, english) => {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString(english ? 'en-US' : 'id-ID', {year:'numeric',month:'short',day:'numeric'}) : '';
  };
  const renderMessage = (target, message, kind = 'loading') => {
    target.innerHTML = `<div class="ref-state ${kind}"><i class="fa-solid ${kind === 'error' ? 'fa-circle-exclamation' : kind === 'empty' ? 'fa-circle-info' : 'fa-spinner fa-spin'}"></i><p>${esc(message)}</p></div>`;
  };
  async function initReferral() {
    const lang = localStorage.getItem('boxcellink_lang') || 'id';
    const english = lang === 'en';
    const t = english ? {
      login:'Please <a href="/login.html">sign in</a> to view your referral dashboard.', loading:'Loading referral data…',
      error:'Unable to load referral dashboard. Please refresh and try again.',
      linkTitle:'Your referral link',copy:'Copy link',copied:'Copied!',copyFail:'Copy failed — select and copy the link manually.',
      referrals:'referrals',rewardBalance:'Referral deposit rewards',perReferral:'Rp1,000 per eligible referral · spend it on VIP and Telegram media',invite:'Invite friends using your link. Each eligible referral credits Rp1,000 to your deposit wallet.',
      progress:'Referral reward milestones',reached:'Reached',notYet:'Not yet',remaining:'to go',
      coupons:'Your discount coupons',remainingUses:'uses available',couponEmpty:'No discount coupons yet. Referral cash rewards are credited to your deposit wallet.',
      rewards:'Rewards earned',rewardEmpty:'Rewards appear automatically when you reach a referral milestone.',
      rewardDate:'Earned',balanceError:'Could not read referral reward balance; showing Rp0 temporarily.'
    } : {
      login:'Silakan <a href="/login.html">login</a> untuk melihat dashboard referral kamu.', loading:'Memuat data referral…',
      error:'Dashboard referral tidak dapat dimuat. Silakan refresh dan coba lagi.',
      linkTitle:'Link referral kamu',copy:'Salin link',copied:'Tersalin!',copyFail:'Gagal menyalin — pilih dan salin link secara manual.',
      referrals:'referral',rewardBalance:'Saldo hadiah referral',perReferral:'Rp1.000 per referral yang memenuhi ketentuan · gunakan untuk VIP dan Media Telegram',
      invite:'Ajak teman menggunakan link ini. Setiap referral yang memenuhi ketentuan menambahkan Rp1.000 ke saldo deposit kamu.',
      progress:'Target hadiah referral',reached:'Tercapai',notYet:'Belum',remaining:'lagi',
      coupons:'Kode diskon kamu',remainingUses:'pemakaian tersedia',couponEmpty:'Belum ada kode diskon. Hadiah referral masuk ke saldo deposit kamu.',
      rewards:'Hadiah yang sudah didapat',rewardEmpty:'Hadiah akan otomatis muncul saat kamu mencapai target referral.',
      rewardDate:'Diterima',balanceError:'Saldo hadiah referral gagal dibaca; sementara menampilkan Rp0.'
    };
    if (!mainBox || !progressBox || !couponBox || !rewardBox || typeof sb === 'undefined') return;
    renderMessage(mainBox, t.loading);
    try {
      const {data: authData, error: authError} = await sb.auth.getUser();
      if (authError) throw authError;
      const user = authData?.user;
      if (!user) {
        mainBox.innerHTML = `<div class=\"ref-state empty\"><i class=\"fa-solid fa-user-lock\"></i><p>${english?'Please':'Silakan'} <a href=\"/login.html\">${english?'sign in':'login'}</a> ${english?'to view your referral dashboard.':'untuk melihat dashboard referral kamu.'}</p></div>`;
        progressBox.innerHTML = couponBox.innerHTML = rewardBox.innerHTML = '';
        return;
      }
      const {data, error} = await sb.rpc('get_referral_summary');
      if (error) throw error;
      if (!data || typeof data !== 'object') throw new Error('RPC returned unexpected data');
      const count = Math.max(0, Number(data.referral_count) || 0);
      const code = String(data.referral_code || '').trim();
      const referralLink = `${location.origin}/register.html?ref=${encodeURIComponent(code)}`;
      let cashTotal = 0, balanceWarning = false;
      const {data: cashRows, error: cashError} = await sb.from('wallet_ledger').select('amount')
        .eq('user_id', user.id).eq('entry_type', 'referral_reward').eq('wallet_type', 'deposit');
      if (cashError) balanceWarning = true;
      else cashTotal = (cashRows || []).reduce((sum, row) => sum + Number(row.amount || 0), 0);
      mainBox.innerHTML = `
        <div class="ref-main-label">${esc(t.linkTitle)}</div>
        <div class="ref-link-row"><input id="myRefLink" readonly value="${esc(referralLink)}" aria-label="${esc(t.linkTitle)}"><button type="button" class="ref-btn" id="copyRef"><i class="fa-regular fa-copy"></i><span>${esc(t.copy)}</span></button></div>
        <div class="ref-count-panel"><strong>${count.toLocaleString('id-ID')}</strong><span>${esc(t.referrals)}</span></div>
        <div class="ref-cash-summary"><span>${esc(t.rewardBalance)}</span><strong>${balanceWarning?'—':money(cashTotal)}</strong><small>${esc(t.perReferral)}</small></div>
        ${balanceWarning ? `<p class="ref-warning"><i class="fa-solid fa-circle-exclamation"></i> ${esc(t.balanceError)}</p>` : ''}
        <p class="ref-intro">${esc(t.invite)}</p>`;
      const copyBtn = document.getElementById('copyRef');
      copyBtn?.addEventListener('click', async () => {
        const input = document.getElementById('myRefLink');
        try {
          if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(referralLink);
          else { input.focus(); input.select(); if (!document.execCommand('copy')) throw new Error('copy command failed'); }
          copyBtn.innerHTML = `<i class="fa-solid fa-check"></i><span>${esc(t.copied)}</span>`;
        } catch {
          input.focus(); input.select();
          copyBtn.innerHTML = `<i class="fa-solid fa-copy"></i><span>${esc(t.copyFail)}</span>`;
        }
      });
      const milestones = [
        {n:5,kind:'discount',id:'m5',name:english?'20% review coupon':'Kupon review 20%',desc:english?'2 coupon uses':'2 kali pemakaian kupon'},
        {n:10,kind:'discount',id:'m10',name:english?'50% review coupon':'Kupon review 50%',desc:english?'4 coupon uses':'4 kali pemakaian kupon'},
        {n:30,kind:'vip',id:'m30',name:english?'2-day VIP':'VIP 2 hari',desc:english?'VIP access extension':'Tambahan masa akses VIP'},
        {n:50,kind:'vip',id:'m50',name:english?'7-day VIP':'VIP 7 hari',desc:english?'VIP access extension':'Tambahan masa akses VIP'},
        {n:100,kind:'vip',id:'m100',name:english?'30-day VIP':'VIP 30 hari',desc:english?'VIP access extension':'Tambahan masa akses VIP'}
      ];
      progressBox.innerHTML = milestones.map(m => {
        const pct = Math.min(100, count / m.n * 100);
        const hit = count >= m.n;
        return `<article class="ref-milestone ${hit?'is-reached':''}"><div class="ref-milestone-head"><span class="ref-milestone-icon"><i class="fa-solid ${m.kind==='vip'?'fa-crown':'fa-ticket'}"></i></span><div class="ref-milestone-copy"><b>${m.n} ${esc(t.referrals)} · ${esc(m.name)}</b><small>${esc(m.desc)}</small></div><span class="ref-status ${hit?'done':'pending'}">${hit?esc(t.reached):esc(t.notYet)}</span></div><div class="ref-progress"><span style="width:${pct.toFixed(1)}%"></span></div><small class="ref-progress-caption">${Math.min(count,m.n)} / ${m.n} ${esc(t.referrals)}${hit?' · '+esc(t.reached):' · '+(m.n-count)+' '+esc(t.remaining)}</small></article>`;
      }).join('');
      const coupons = Array.isArray(data.coupons) ? data.coupons : [];
      couponBox.innerHTML = coupons.length ? coupons.map(c => {
        const total = Math.max(0, Number(c.uses_total)||0), used = Math.max(0, Number(c.uses_used)||0), reserved = Math.max(0, Number(c.uses_reserved)||0);
        const available = Math.max(0,total-used-reserved);
        return `<article class="ref-coupon"><div class="ref-coupon-top"><code class="ref-code">${esc(c.code)}</code><span class="ref-discount">${Number(c.discount_percent)||0}%</span></div><div class="ref-coupon-foot">${available.toLocaleString('id-ID')} ${esc(t.remainingUses)} <span>${used}/${total} ${english?'used':'terpakai'}${reserved?` · ${reserved} ${english?'reserved':'dipesan'}`:''}</span></div></article>`;
      }).join('') : `<div class="ref-state empty"><i class="fa-solid fa-ticket"></i><p>${esc(t.couponEmpty)}</p></div>`;
      const rewards = Array.isArray(data.rewards) ? data.rewards : [];
      rewardBox.innerHTML = rewards.length ? rewards.map(r => {
        let desc = String(r.description || '');
        if (english) desc = desc.replace('Diskon 20% untuk 2 kali pembelian review','20% discount for 2 review purchases').replace('Diskon 50% untuk 4 kali pembelian review','50% discount for 4 review purchases').replace('Bonus VIP 2 hari','2-day VIP bonus').replace('Bonus VIP 7 hari','7-day VIP bonus').replace('Bonus VIP 30 hari','30-day VIP bonus');
        const earned = dateLabel(r.created_at, english);
        return `<article class="ref-reward-row"><span class="ref-reward-check"><i class="fa-solid fa-check"></i></span><div><b>${esc(desc)}</b>${earned?`<small>${esc(t.rewardDate)} · ${esc(earned)}</small>`:''}</div></article>`;
      }).join('') : `<div class="ref-state empty"><i class="fa-solid fa-gift"></i><p>${esc(t.rewardEmpty)}</p></div>`;
    } catch (error) {
      console.error('[Referral dashboard]', error);
      renderMessage(mainBox, t.error, 'error');
      progressBox.innerHTML = couponBox.innerHTML = rewardBox.innerHTML = '';
    }
  }
  initReferral();
})();
