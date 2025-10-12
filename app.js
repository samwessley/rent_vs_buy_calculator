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

function computeBuyVsRent(){
  const homePrice = +document.getElementById('homePrice').value;
  const monthlyRent = +document.getElementById('monthlyRent').value;
  const years = +document.getElementById('years').value;

  const mortgageRate = +document.getElementById('mortgageRate').value;
  const downPaymentPct = +document.getElementById('downPaymentPct').value;
  const mortgageYears = +document.getElementById('mortgageYears').value;
  const pmiRatePct = +document.getElementById('pmiRatePct').value;

  const homeGrowthPct = +document.getElementById('homeGrowthPct').value;
  const rentGrowthPct = +document.getElementById('rentGrowthPct').value;
  const investmentReturnPct = +document.getElementById('investmentReturnPct').value;
  const inflationPct = +document.getElementById('inflationPct').value;

  const filingStatus = document.getElementById('filingStatus').value;
  const propertyTaxRatePct = +document.getElementById('propertyTaxRatePct').value;
  const marginalTaxRatePct = +document.getElementById('marginalTaxRatePct').value;
  const otherItemizedDeductions = +document.getElementById('otherItemizedDeductions').value;

  const buyClosingPct = +document.getElementById('buyClosingPct').value;
  const sellClosingPct = +document.getElementById('sellClosingPct').value;

  const maintenancePct = +document.getElementById('maintenancePct').value;
  const homeInsurancePct = +document.getElementById('homeInsurancePct').value;
  const extraUtilitiesMonthly = +document.getElementById('extraUtilitiesMonthly').value;
  const hoaMonthly = +document.getElementById('hoaMonthly').value;
  const hoaDeductiblePct = +document.getElementById('hoaDeductiblePct').value;

  const securityDepositInitial = +document.getElementById('securityDepositInitial').value;
  const brokersFeePct = +document.getElementById('brokersFeePct').value;
  const rentersInsuranceInitial = +document.getElementById('rentersInsuranceInitial').value;
  const rentersInsuranceGrowthPct = +document.getElementById('rentersInsuranceGrowthPct').value;
  const capitalGainsRatePct = +document.getElementById('capitalGainsRatePct').value;

  const downPayment = homePrice * pct(downPaymentPct);
  const loanAmount = homePrice - downPayment;
  const buyClosing = homePrice * pct(buyClosingPct);
  const amort = buildAmortization(loanAmount, mortgageRate, mortgageYears);
  const months = years*12;
  const monthsConsidered = Math.min(months, amort.length);

  const annualPropertyTaxStart = homePrice * pct(propertyTaxRatePct);
  const hasPMI = downPaymentPct < 20 && pmiRatePct > 0;

  let totalMortgagePayments = 0;
  let totalMortgageInterest = 0;
  let totalPMI = 0;
  let totalPropertyTax = 0;
  let totalMaintenance = 0;
  let totalHomeInsurance = 0;
  let totalHOAFees = 0;
  let totalExtraUtilities = 0;
  let totalTaxSavings = 0;

  let currentHomeValue = homePrice;
  let currentAnnualPropertyTax = annualPropertyTaxStart;
  let currentHOAAnnual = hoaMonthly*12;
  let currentExtraUtilitiesAnnual = extraUtilitiesMonthly*12;

  // Track monthly net cash flows for precise opportunity cost
  const buyMonthlyNetCashFlows = [];
  let accumulatedYearTaxSavings = 0;

  for(let m=0;m<monthsConsidered;m++){
    const row = amort[m];
    if(!row) break;
    totalMortgagePayments += row.payment;
    totalMortgageInterest += row.interest;

    const monthIndexInYear = m % 12;
    const currentMaintenance = currentHomeValue * pct(maintenancePct);
    const currentHomeInsurance = currentHomeValue * pct(homeInsurancePct);
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

    const monthlyPMI = (hasPMI && row.remaining > homePrice*0.8) ? (loanAmount * pct(pmiRatePct))/12 : 0;
    totalPMI += monthlyPMI;

    // Store gross monthly cash flow (before tax savings)
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
      const deductibleHOAYear = currentHOAAnnual * pct(hoaDeductiblePct);
      const stdDeductionYear = computeStandardDeduction(filingStatus);
      const baseline = stdDeductionYear;
      const potentialItemizedYear = cappedInterest + saltDeductible + deductibleHOAYear + otherItemizedDeductions;
      const taxBenefitBaseYear = Math.max(0, potentialItemizedYear - baseline);
      const yearTaxSavings = taxBenefitBaseYear * pct(marginalTaxRatePct);
      totalTaxSavings += yearTaxSavings;

      // Apply year's tax savings to the last month of the year
      buyMonthlyNetCashFlows[buyMonthlyNetCashFlows.length - 1] -= yearTaxSavings;

      currentHomeValue *= (1 + pct(homeGrowthPct));
      currentAnnualPropertyTax = currentHomeValue * pct(propertyTaxRatePct);
    }
  }

  function futureValueOfSeries(paymentPerPeriod, annualRatePctLocal, periods){
    const monthlyRate = Math.pow(1 + pct(annualRatePctLocal), 1/12) - 1;
    if(monthlyRate === 0) return paymentPerPeriod * periods;
    return paymentPerPeriod * (Math.pow(1+monthlyRate, periods) - 1) / monthlyRate;
  }

  function futureValueLumpSum(present, annualRatePctLocal, periods){
    const monthlyRate = Math.pow(1 + pct(annualRatePctLocal), 1/12) - 1;
    return present * Math.pow(1+monthlyRate, periods);
  }

  const buyInitialCash = downPayment + buyClosing;
  const buyRecurringGross = totalMortgagePayments + totalPMI + totalPropertyTax + totalMaintenance + totalHomeInsurance + totalHOAFees + totalExtraUtilities;

  // Compute opportunity cost from actual monthly cash flows
  const buyOppFromInitialFV = futureValueLumpSum(buyInitialCash, investmentReturnPct, monthsConsidered);
  const buyOppFromInitialEarnings = Math.max(0, buyOppFromInitialFV - buyInitialCash);
  const buyOppFromInitial = buyOppFromInitialEarnings * (1 - pct(capitalGainsRatePct));
  
  let buyOppFromRecurring = 0;
  const monthlyRate = Math.pow(1 + pct(investmentReturnPct), 1/12) - 1;
  for(let i=0; i<buyMonthlyNetCashFlows.length; i++){
    const monthsToGrow = monthsConsidered - i;
    const fv = buyMonthlyNetCashFlows[i] * Math.pow(1 + monthlyRate, monthsToGrow);
    const earnings = Math.max(0, fv - buyMonthlyNetCashFlows[i]);
    buyOppFromRecurring += earnings * (1 - pct(capitalGainsRatePct));
  }
  const totalBuyOpportunityCost = buyOppFromInitial + buyOppFromRecurring;

  const valueAtExit = homePrice * Math.pow(1+pct(homeGrowthPct), years);
  const sellCosts = valueAtExit * pct(sellClosingPct);
  const remainingPrincipal = amort[Math.min(monthsConsidered, amort.length)-1]?.remaining ?? 0;
  const rawProceeds = valueAtExit - sellCosts - remainingPrincipal;
  const exclusion = (filingStatus === 'joint') ? 500000 : 250000;
  const gain = Math.max(0, valueAtExit - homePrice - sellCosts);
  const taxableGain = Math.max(0, gain - exclusion);
  const capGainsTax = taxableGain * pct(capitalGainsRatePct);
  const netProceeds = rawProceeds - capGainsTax;

  const totalBuyInitial = buyInitialCash;
  const totalBuyRecurring = buyRecurringGross - totalTaxSavings;
  const totalBuy = totalBuyInitial + totalBuyRecurring + totalBuyOpportunityCost - netProceeds;

  // Build monthly rent cash flows
  const rentMonthlyNetCashFlows = [];
  let rentTotalRecurring = 0;
  let rentInsuranceTotal = 0;
  let rent = monthlyRent;
  let rentersInsurance = rentersInsuranceInitial;
  for(let y=0;y<years;y++){
    for(let m=0;m<12 && rentMonthlyNetCashFlows.length < monthsConsidered; m++){
      rentMonthlyNetCashFlows.push(rent + rentersInsurance/12);
    }
    rentTotalRecurring += rent*12;
    rentInsuranceTotal += rentersInsurance;
    rent *= (1 + pct(rentGrowthPct));
    rentersInsurance *= (1 + pct(rentersInsuranceGrowthPct));
  }
  const rentInitial = securityDepositInitial + (brokersFeePct>0 ? monthlyRent*12*pct(brokersFeePct) : 0);
  const rentNetProceeds = securityDepositInitial;

  // Compute opportunity cost from actual monthly rent cash flows
  const rentOppFromInitialFV = futureValueLumpSum(rentInitial, investmentReturnPct, monthsConsidered);
  const rentOppFromInitialEarnings = Math.max(0, rentOppFromInitialFV - rentInitial);
  const rentOppFromInitial = rentOppFromInitialEarnings * (1 - pct(capitalGainsRatePct));
  
  let rentOppFromRecurring = 0;
  for(let i=0; i<rentMonthlyNetCashFlows.length; i++){
    const monthsToGrow = monthsConsidered - i;
    const fv = rentMonthlyNetCashFlows[i] * Math.pow(1 + monthlyRate, monthsToGrow);
    const earnings = Math.max(0, fv - rentMonthlyNetCashFlows[i]);
    rentOppFromRecurring += earnings * (1 - pct(capitalGainsRatePct));
  }
  const totalRentOpportunityCost = rentOppFromInitial + rentOppFromRecurring;

  const totalRent = rentInitial + rentTotalRecurring + rentInsuranceTotal + totalRentOpportunityCost - rentNetProceeds;

  document.getElementById('totalBuy').textContent = formatCurrency(totalBuy);
  document.getElementById('totalRent').textContent = formatCurrency(totalRent);
  const diff = Math.abs(totalBuy - totalRent);
  const winner = totalBuy < totalRent ? 'Buying is better' : 'Renting is better';
  document.getElementById('winnerLabel').textContent = winner;
  document.getElementById('difference').textContent = `${formatCurrency(diff)} over ${years} years`;

  const buyBreakdown = [
    {name:'Initial costs (down + closing)', amount: totalBuyInitial},
    {name:'Recurring costs (all-in, after tax)', amount: totalBuyRecurring},
    {name:'Opportunity costs', amount: totalBuyOpportunityCost},
    {name:'Net proceeds on sale', amount: -netProceeds}
  ];
  const rentBreakdown = [
    {name:'Initial costs (deposit + broker)', amount: rentInitial},
    {name:'Recurring costs (rent + insurance)', amount: rentTotalRecurring + rentInsuranceTotal},
    {name:'Opportunity costs', amount: totalRentOpportunityCost},
    {name:'Net proceeds (deposit return)', amount: -rentNetProceeds}
  ];

  function renderList(elId, items){
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
  }
  renderList('buyBreakdown', buyBreakdown);
  renderList('rentBreakdown', rentBreakdown);
}

function hookInputs(){
  const inputs = document.querySelectorAll('input, select');
  inputs.forEach(el=>{
    el.addEventListener('input', computeBuyVsRent);
    el.addEventListener('change', computeBuyVsRent);
  });
}

window.addEventListener('DOMContentLoaded', ()=>{
  hookInputs();
  computeBuyVsRent();
});
