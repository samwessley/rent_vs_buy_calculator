function formatCurrency(amount){
  if(!Number.isFinite(amount)) return '—';
  const sign = amount < 0 ? '-' : '';
  const n = Math.abs(amount);
  return sign + n.toLocaleString(undefined,{style:'currency',currency:'USD',maximumFractionDigits:0});
}

function pct(n){return n/100}

function monthlyPayment(principal, annualRatePct, years){
  const r = pct(annualRatePct)/12;
  const n = years*12;
  if(r === 0) return principal / n;
  const m = principal * (r*Math.pow(1+r,n))/(Math.pow(1+r,n)-1);
  return m;
}

function buildAmortization(principal, annualRatePct, years){
  const r = pct(annualRatePct)/12;
  const n = years*12;
  const schedule = [];
  let remaining = principal;
  const m = r === 0 ? principal/n : principal * (r*Math.pow(1+r,n))/(Math.pow(1+r,n)-1);
  for(let i=0;i<n;i++){
    const interest = remaining * r;
    const principalPaid = Math.min(m - interest, remaining);
    remaining = Math.max(0, remaining - principalPaid);
    schedule.push({month:i+1, payment:m, interest, principal:principalPaid, remaining});
  }
  return schedule;
}

function computeStandardDeduction(filing){
  return filing === 'joint' ? 29200 : 14600;
}

function miDeductionCap(){
  return 750000;
}

function saltCap(){
  return 10000;
}

function readInputs(){
  return {
    homePrice: +document.getElementById('homePrice').value,
    monthlyRent: +document.getElementById('monthlyRent').value,
    years: +document.getElementById('years').value,
    mortgageRate: +document.getElementById('mortgageRate').value,
    downPaymentPct: +document.getElementById('downPaymentPct').value,
    mortgageYears: +document.getElementById('mortgageYears').value,
    pmiRatePct: +document.getElementById('pmiRatePct').value,
    homeGrowthPct: +document.getElementById('homeGrowthPct').value,
    rentGrowthPct: +document.getElementById('rentGrowthPct').value,
    investmentReturnPct: +document.getElementById('investmentReturnPct').value,
    inflationPct: +document.getElementById('inflationPct').value,
    filingStatus: document.getElementById('filingStatus').value,
    propertyTaxRatePct: +document.getElementById('propertyTaxRatePct').value,
    marginalTaxRatePct: +document.getElementById('marginalTaxRatePct').value,
    otherItemizedDeductions: +document.getElementById('otherItemizedDeductions').value,
    buyClosingPct: +document.getElementById('buyClosingPct').value,
    sellClosingPct: +document.getElementById('sellClosingPct').value,
    maintenancePct: +document.getElementById('maintenancePct').value,
    homeInsurancePct: +document.getElementById('homeInsurancePct').value,
    extraUtilitiesMonthly: +document.getElementById('extraUtilitiesMonthly').value,
    hoaMonthly: +document.getElementById('hoaMonthly').value,
    hoaDeductiblePct: +document.getElementById('hoaDeductiblePct').value,
    securityDepositInitial: +document.getElementById('securityDepositInitial').value,
    brokersFeePct: +document.getElementById('brokersFeePct').value,
    rentersInsuranceInitial: +document.getElementById('rentersInsuranceInitial').value,
    rentersInsuranceGrowthPct: +document.getElementById('rentersInsuranceGrowthPct').value,
    capitalGainsRatePct: +document.getElementById('capitalGainsRatePct').value,
  };
}

function computeTotals(s){
  const downPayment = s.homePrice * pct(s.downPaymentPct);
  const loanAmount = s.homePrice - downPayment;
  const buyClosing = s.homePrice * pct(s.buyClosingPct);
  const amort = buildAmortization(loanAmount, s.mortgageRate, s.mortgageYears);
  const months = s.years*12;
  const monthsConsidered = Math.min(months, amort.length);

  const annualPropertyTaxStart = s.homePrice * pct(s.propertyTaxRatePct);
  const hasPMI = s.downPaymentPct < 20 && s.pmiRatePct > 0;

  let totalMortgagePayments = 0;
  let totalMortgageInterest = 0;
  let totalPMI = 0;
  let totalPropertyTax = 0;
  let totalMaintenance = 0;
  let totalHomeInsurance = 0;
  let totalHOAFees = 0;
  let totalExtraUtilities = 0;
  let totalTaxSavings = 0;

  let currentHomeValue = s.homePrice;
  let currentAnnualPropertyTax = annualPropertyTaxStart;
  let currentHOAAnnual = s.hoaMonthly*12;
  let currentExtraUtilitiesAnnual = s.extraUtilitiesMonthly*12;

  const buyMonthlyNetCashFlows = [];
  for(let m=0;m<monthsConsidered;m++){
    const row = amort[m];
    if(!row) break;
    totalMortgagePayments += row.payment;
    totalMortgageInterest += row.interest;

    const monthIndexInYear = m % 12;
    const currentMaintenance = currentHomeValue * pct(s.maintenancePct);
    const currentHomeInsurance = currentHomeValue * pct(s.homeInsurancePct);
    const monthlyPropertyTax = currentAnnualPropertyTax/12;
    const monthlyMaintenance = currentMaintenance/12;
    const monthlyHomeInsurance = currentHomeInsurance/12;
    const monthlyHOA = currentHOAAnnual/12;
    const monthlyUtilities = currentExtraUtilitiesAnnual/12;

    totalPropertyTax += monthlyPropertyTax;
    totalMaintenance += monthlyMaintenance;
    totalHomeInsurance += monthlyHomeInsurance;
    totalHOAFees += monthlyHOA;
    totalExtraUtilities += monthlyUtilities;

    const monthlyPMI = (hasPMI && row.remaining > s.homePrice*0.8) ? (loanAmount * pct(s.pmiRatePct))/12 : 0;
    totalPMI += monthlyPMI;

    const monthlyGrossCashFlow = row.payment + monthlyPMI + monthlyPropertyTax + monthlyMaintenance + monthlyHomeInsurance + monthlyHOA + monthlyUtilities;
    buyMonthlyNetCashFlows.push(monthlyGrossCashFlow);

    if(monthIndexInYear === 11){
      const idxStart = m - 11;
      const idxEnd = m;
      let yearInterest = 0;
      for(let k=idxStart;k<=idxEnd;k++) yearInterest += amort[k]?.interest ?? 0;
      const interestCapFactor = Math.min(1, miDeductionCap() / Math.max(1, loanAmount));
      const cappedInterest = yearInterest * interestCapFactor;
      const saltDeductible = Math.min(saltCap(), currentAnnualPropertyTax);
      const deductibleHOAYear = currentHOAAnnual * pct(s.hoaDeductiblePct);
      const stdDeductionYear = computeStandardDeduction(s.filingStatus);
      const baseline = stdDeductionYear;
      const potentialItemizedYear = cappedInterest + saltDeductible + deductibleHOAYear + s.otherItemizedDeductions;
      const taxBenefitBaseYear = Math.max(0, potentialItemizedYear - baseline);
      const yearTaxSavings = taxBenefitBaseYear * pct(s.marginalTaxRatePct);
      totalTaxSavings += yearTaxSavings;
      buyMonthlyNetCashFlows[buyMonthlyNetCashFlows.length - 1] -= yearTaxSavings;

      currentHomeValue *= (1 + pct(s.homeGrowthPct));
      currentAnnualPropertyTax = currentHomeValue * pct(s.propertyTaxRatePct);
    }
  }

  const buyInitialCash = downPayment + buyClosing;
  const monthlyRate = Math.pow(1 + pct(s.investmentReturnPct), 1/12) - 1;
  const buyOppFromInitialFV = buyInitialCash * Math.pow(1 + monthlyRate, monthsConsidered);
  const buyOppFromInitialEarnings = Math.max(0, buyOppFromInitialFV - buyInitialCash);
  const buyOppFromInitial = buyOppFromInitialEarnings * (1 - pct(s.capitalGainsRatePct));
  let buyOppFromRecurring = 0;
  for(let i=0; i<buyMonthlyNetCashFlows.length; i++){
    const monthsToGrow = monthsConsidered - i;
    const fv = buyMonthlyNetCashFlows[i] * Math.pow(1 + monthlyRate, monthsToGrow);
    const earnings = Math.max(0, fv - buyMonthlyNetCashFlows[i]);
    buyOppFromRecurring += earnings * (1 - pct(s.capitalGainsRatePct));
  }
  const totalBuyOpportunityCost = buyOppFromInitial + buyOppFromRecurring;

  const valueAtExit = s.homePrice * Math.pow(1+pct(s.homeGrowthPct), s.years);
  const sellCosts = valueAtExit * pct(s.sellClosingPct);
  const remainingPrincipal = amort[Math.min(monthsConsidered, amort.length)-1]?.remaining ?? 0;
  const rawProceeds = valueAtExit - sellCosts - remainingPrincipal;
  const exclusion = (s.filingStatus === 'joint') ? 500000 : 250000;
  const gain = Math.max(0, valueAtExit - s.homePrice - sellCosts);
  const taxableGain = Math.max(0, gain - exclusion);
  const capGainsTax = taxableGain * pct(s.capitalGainsRatePct);
  const netProceeds = rawProceeds - capGainsTax;

  const totalBuyInitial = buyInitialCash;
  const totalBuyRecurring = (totalMortgagePayments + totalPMI + totalPropertyTax + totalMaintenance + totalHomeInsurance + totalHOAFees + totalExtraUtilities) - totalTaxSavings;
  const totalBuy = totalBuyInitial + totalBuyRecurring + totalBuyOpportunityCost - netProceeds;

  // Rent side
  const rentMonthlyNetCashFlows = [];
  let rentTotalRecurring = 0;
  let rentInsuranceTotal = 0;
  let rent = s.monthlyRent;
  let rentersInsurance = s.rentersInsuranceInitial;
  for(let y=0;y<s.years;y++){
    for(let m=0;m<12 && rentMonthlyNetCashFlows.length < monthsConsidered; m++){
      rentMonthlyNetCashFlows.push(rent + rentersInsurance/12);
    }
    rentTotalRecurring += rent*12;
    rentInsuranceTotal += rentersInsurance;
    rent *= (1 + pct(s.rentGrowthPct));
    rentersInsurance *= (1 + pct(s.rentersInsuranceGrowthPct));
  }
  const rentInitial = s.securityDepositInitial + (s.brokersFeePct>0 ? s.monthlyRent*12*pct(s.brokersFeePct) : 0);
  const rentNetProceeds = s.securityDepositInitial;

  const rentOppFromInitialFV = rentInitial * Math.pow(1 + monthlyRate, monthsConsidered);
  const rentOppFromInitialEarnings = Math.max(0, rentOppFromInitialFV - rentInitial);
  const rentOppFromInitial = rentOppFromInitialEarnings * (1 - pct(s.capitalGainsRatePct));
  let rentOppFromRecurring = 0;
  for(let i=0; i<rentMonthlyNetCashFlows.length; i++){
    const monthsToGrow = monthsConsidered - i;
    const fv = rentMonthlyNetCashFlows[i] * Math.pow(1 + monthlyRate, monthsToGrow);
    const earnings = Math.max(0, fv - rentMonthlyNetCashFlows[i]);
    rentOppFromRecurring += earnings * (1 - pct(s.capitalGainsRatePct));
  }
  const totalRentOpportunityCost = rentOppFromInitial + rentOppFromRecurring;
  const totalRent = rentInitial + rentTotalRecurring + rentInsuranceTotal + totalRentOpportunityCost - rentNetProceeds;

  return {
    totalBuy, totalRent,
    totalBuyInitial, totalBuyRecurring, totalBuyOpportunityCost, netProceeds,
    rentInitial, rentRecurring: (rentTotalRecurring + rentInsuranceTotal), totalRentOpportunityCost, rentNetProceeds
  };
}

// Refactor computeBuyVsRent to use computeTotals
function computeBuyVsRent(){
  const s = readInputs();
  const r = computeTotals(s);

  // Update summary winner only
  const diff = Math.abs(r.totalBuy - r.totalRent);
  const buyingBetter = r.totalBuy < r.totalRent;
  const headline = buyingBetter ? 'Buying is better.' : 'Renting is better.';
  const saver = buyingBetter ? 'Buying' : 'Renting';
  document.getElementById('winnerLabel').textContent = headline;
  document.getElementById('difference').textContent = `${saver} saves you ${formatCurrency(diff)} over ${s.years} years`;

  const buyBreakdown = [
    {name:'Initial costs (down + closing)', amount: r.totalBuyInitial},
    {name:'Recurring costs (all-in, after tax)', amount: r.totalBuyRecurring},
    {name:'Opportunity costs', amount: r.totalBuyOpportunityCost},
    {name:'Net proceeds on sale', amount: -r.netProceeds}
  ];
  const rentBreakdown = [
    {name:'Initial costs (deposit + broker)', amount: r.rentInitial},
    {name:'Recurring costs (rent + insurance)', amount: r.rentRecurring},
    {name:'Opportunity costs', amount: r.totalRentOpportunityCost},
    {name:'Net proceeds (deposit return)', amount: -r.rentNetProceeds}
  ];

  function renderList(elId, items, totalLabel, totalAmount){
    const ul = document.getElementById(elId);
    ul.innerHTML='';
    items.forEach(it=>{
      const li = document.createElement('li');
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = it.name;
      const amount = document.createElement('span');
      amount.className = 'amount ' + (it.amount>=0?'pos':'neg');
      amount.textContent = formatCurrency(it.amount);
      li.appendChild(name);
      li.appendChild(amount);
      ul.appendChild(li);
    });
    // Total row
    const totalLi = document.createElement('li');
    totalLi.className = 'total-row';
    const totalName = document.createElement('span');
    totalName.textContent = totalLabel;
    const totalAmt = document.createElement('span');
    totalAmt.textContent = formatCurrency(totalAmount);
    totalLi.appendChild(totalName);
    totalLi.appendChild(totalAmt);
    ul.appendChild(totalLi);
  }
  renderList('buyBreakdown', buyBreakdown, 'Total cost: Buy', r.totalBuy);
  renderList('rentBreakdown', rentBreakdown, 'Total cost: Rent', r.totalRent);
}

function updateSliderGradient(slider, targetId){
  const min = +slider.min;
  const max = +slider.max;
  const stepAttr = parseFloat(slider.step) || 0;
  const sampleCount = 60;
  const dx = (max - min) / sampleCount;

  // Helper to snap to slider step and integer where appropriate
  function snap(val){
    if(stepAttr > 0){
      val = Math.round(val / stepAttr) * stepAttr;
    }
    // Force integers for whole-number sliders
    if(targetId === 'years' || targetId === 'mortgageYears' || targetId === 'downPaymentPct' || targetId === 'marginalTaxRatePct' || targetId === 'hoaDeductiblePct'){
      val = Math.round(val);
    }
    return Math.min(max, Math.max(min, +val.toFixed(4)));
  }

  // Build contiguous color ranges
  const ranges = [];
  let currentColor = null;
  let rangeStartPct = 0;

  for(let i=0;i<=sampleCount;i++){
    const raw = min + dx * i;
    const v = snap(raw);
    const totals = computeTotalAtValue(targetId, v);
    const isBuyingBetter = totals.buy < totals.rent;
    const color = isBuyingBetter ? '#7c3aed' : '#2563eb';
    const pct = (i / sampleCount) * 100;

    if(currentColor === null){
      currentColor = color;
      rangeStartPct = pct;
    }else if(color !== currentColor){
      ranges.push({color: currentColor, start: rangeStartPct, end: pct});
      currentColor = color;
      rangeStartPct = pct;
    }
  }
  // Close last range
  if(currentColor !== null){
    ranges.push({color: currentColor, start: rangeStartPct, end: 100});
  }

  const gradientStops = [];
  ranges.forEach(r=>{
    gradientStops.push(`${r.color} ${r.start}%`, `${r.color} ${r.end}%`);
  });

  slider.style.background = `linear-gradient(to right, ${gradientStops.join(', ')})`;
}

function updateAllSliderGradients(){
  const sliders = document.querySelectorAll('input[type="range"].slider');
  sliders.forEach(slider=>{
    const targetId = slider.getAttribute('data-target');
    if(targetId){
      updateSliderGradient(slider, targetId);
    }
  });
}

function hookInputs(){
  const inputs = document.querySelectorAll('input[type="number"], select');
  inputs.forEach(el=>{
    el.addEventListener('input', ()=>{
      computeBuyVsRent();
      updateAllSliderGradients();
    });
    el.addEventListener('change', ()=>{
      computeBuyVsRent();
      updateAllSliderGradients();
    });
  });

  // Sync sliders with number inputs
  const sliders = document.querySelectorAll('input[type="range"].slider');
  sliders.forEach(slider=>{
    const targetId = slider.getAttribute('data-target');
    const targetInput = document.getElementById(targetId);
    
    if(targetInput){
      // Slider changes number input
      slider.addEventListener('input', ()=>{
        targetInput.value = slider.value;
        computeBuyVsRent();
        updateAllSliderGradients();
      });
      
      // Number input changes slider
      targetInput.addEventListener('input', ()=>{
        const val = +targetInput.value;
        const sliderMin = +slider.min;
        const sliderMax = +slider.max;
        if(val >= sliderMin && val <= sliderMax){
          slider.value = val;
        }
      });
    }
  });
  
  // Initialize gradients
  updateAllSliderGradients();
}

function computeTotalAtValue(inputId, testValue){
  const s = readInputs();
  s[inputId] = (typeof s[inputId] === 'string') ? String(testValue) : +testValue;
  const r = computeTotals(s);
  return { buy: r.totalBuy, rent: r.totalRent };
}

function autoshrink(el, maxFontPx){
  const parentWidth = el.parentElement.clientWidth;
  let size = maxFontPx;
  el.style.fontSize = size + 'px';
  el.style.whiteSpace = 'nowrap';
  while(el.scrollWidth > parentWidth && size > 14){
    size -= 1;
    el.style.fontSize = size + 'px';
  }
}

window.addEventListener('DOMContentLoaded', ()=>{
  hookInputs();
  computeBuyVsRent();
});
