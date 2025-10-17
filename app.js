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

// Helper: parse numeric from an input value (strips $ and commas)
function parseNumber(val){
  if(typeof val !== 'string') val = String(val ?? '');
  const num = Number(val.replace(/[^0-9.\-]/g,''));
  return Number.isFinite(num) ? num : 0;
}

function isDollarField(id){
  return ['homePrice','monthlyRent','extraUtilitiesMonthly','securityDepositInitial','rentersInsuranceInitial'].includes(id);
}

function isPercentField(id){
  return ['mortgageRate','downPaymentPct','pmiRatePct','homeGrowthPct','rentGrowthPct','investmentReturnPct','inflationPct','propertyTaxRatePct','marginalTaxRatePct','buyClosingPct','sellClosingPct','maintenancePct','homeInsurancePct','hoaDeductiblePct','brokersFeePct','rentersInsuranceGrowthPct','capitalGainsRatePct'].includes(id);
}

function isYearsField(id){
  return ['years','mortgageYears'].includes(id);
}

function formatInputValue(id, numericValue){
  if(isDollarField(id)){
    return numericValue.toLocaleString(undefined,{style:'currency',currency:'USD',maximumFractionDigits:0});
  }else if(isPercentField(id)){
    return numericValue.toFixed(2) + '%';
  }else if(isYearsField(id)){
    const years = Math.round(numericValue);
    return years + (years === 1 ? ' year' : ' years');
  }
  return String(numericValue);
}

function formatSliderLabel(id, numericValue){
  if(isDollarField(id)){
    // Shorter format for slider labels
    if(numericValue >= 1000000){
      const millions = numericValue/1000000;
      return '$' + (millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(1)) + 'M';
    }else if(numericValue >= 1000){
      return '$' + Math.round(numericValue/1000) + 'K';
    }
    return '$' + numericValue;
  }else if(isPercentField(id)){
    return numericValue.toFixed(0) + '%';
  }else if(isYearsField(id)){
    return Math.round(numericValue).toString();
  }
  return String(numericValue);
}

function getMidpointLabels(id, minVal, maxVal){
  // Return array of values to show as labels, including key midpoints
  if(id === 'homePrice'){
    // For home price: $70K, $500K, $2M, $6M
    // Note: $2M label positioned at slider value that represents $2M (not at a different value)
    return [70000, 500000, 2000000, 6000000];
  }else if(id === 'monthlyRent'){
    // For monthly rent: $500, $5K, $10K, $30K
    return [500, 5000, 10000, 30000];
  }else if(id === 'years'){
    // For years: 2, 10, 20, 30, 40
    return [2, 10, 20, 30, 40];
  }else{
    // Default: min and max only
    return [minVal, maxVal];
  }
}

// Non-linear slider mapping functions
function homePriceSliderToValue(sliderPos){
  // sliderPos: 0-100
  // Map to $70K - $6M with emphasis on lower values
  // 0-70: $70K to $1M (most of the range)
  // 70-75: $1M to $2M (3/4 of the way = 75%)
  // 75-100: $2M to $6M
  const min = 70000;
  const mid1 = 1000000;
  const mid2 = 2000000;
  const max = 6000000;
  
  if(sliderPos <= 70){
    // Linear interpolation from $70K to $1M
    const t = sliderPos / 70;
    return min + t * (mid1 - min);
  }else if(sliderPos <= 75){
    // Linear interpolation from $1M to $2M
    const t = (sliderPos - 70) / 5;
    return mid1 + t * (mid2 - mid1);
  }else{
    // Linear interpolation from $2M to $6M
    const t = (sliderPos - 75) / 25;
    return mid2 + t * (max - mid2);
  }
}

function homePriceValueToSlider(value){
  // Inverse mapping: value to slider position 0-100
  const min = 70000;
  const mid1 = 1000000;
  const mid2 = 2000000;
  const max = 6000000;
  
  if(value <= mid1){
    return (value - min) / (mid1 - min) * 70;
  }else if(value <= mid2){
    return 70 + (value - mid1) / (mid2 - mid1) * 5;
  }else{
    return 75 + Math.min(25, (value - mid2) / (max - mid2) * 25);
  }
}

function monthlyRentSliderToValue(sliderPos){
  // sliderPos: 0-100
  // Map to $500 - $30K with emphasis on lower values
  // 0-70: $500 to $5K
  // 70-90: $5K to $10K
  // 90-100: $10K to $30K
  const min = 500;
  const mid1 = 5000;
  const mid2 = 10000;
  const max = 30000;
  
  if(sliderPos <= 70){
    const t = sliderPos / 70;
    return min + t * (mid1 - min);
  }else if(sliderPos <= 90){
    const t = (sliderPos - 70) / 20;
    return mid1 + t * (mid2 - mid1);
  }else{
    const t = (sliderPos - 90) / 10;
    return mid2 + t * (max - mid2);
  }
}

function monthlyRentValueToSlider(value){
  const min = 500;
  const mid1 = 5000;
  const mid2 = 10000;
  const max = 30000;
  
  if(value <= mid1){
    return (value - min) / (mid1 - min) * 70;
  }else if(value <= mid2){
    return 70 + (value - mid1) / (mid2 - mid1) * 20;
  }else{
    return 90 + Math.min(10, (value - mid2) / (max - mid2) * 10);
  }
}

function sliderToValue(slider, sliderPos){
  const nonlinearType = slider.getAttribute('data-nonlinear');
  if(nonlinearType === 'homePrice'){
    return Math.round(homePriceSliderToValue(sliderPos) / 1000) * 1000;
  }else if(nonlinearType === 'monthlyRent'){
    return Math.round(monthlyRentSliderToValue(sliderPos) / 50) * 50;
  }else{
    // Linear slider
    return parseNumber(sliderPos);
  }
}

function valueToSlider(slider, value){
  const nonlinearType = slider.getAttribute('data-nonlinear');
  if(nonlinearType === 'homePrice'){
    return homePriceValueToSlider(value);
  }else if(nonlinearType === 'monthlyRent'){
    return monthlyRentValueToSlider(value);
  }else{
    // Linear slider
    return value;
  }
}

function readInputs(){
  return {
    homePrice: parseNumber(document.getElementById('homePrice').value),
    monthlyRent: parseNumber(document.getElementById('monthlyRent').value),
    years: parseNumber(document.getElementById('years').value),
    mortgageRate: parseNumber(document.getElementById('mortgageRate').value),
    downPaymentPct: parseNumber(document.getElementById('downPaymentPct').value),
    mortgageYears: parseNumber(document.getElementById('mortgageYears').value),
    pmiRatePct: parseNumber(document.getElementById('pmiRatePct').value),
    homeGrowthPct: parseNumber(document.getElementById('homeGrowthPct').value),
    rentGrowthPct: parseNumber(document.getElementById('rentGrowthPct').value),
    investmentReturnPct: parseNumber(document.getElementById('investmentReturnPct').value),
    inflationPct: parseNumber(document.getElementById('inflationPct').value),
    filingStatus: document.getElementById('filingStatus').value,
    propertyTaxRatePct: parseNumber(document.getElementById('propertyTaxRatePct').value),
    marginalTaxRatePct: parseNumber(document.getElementById('marginalTaxRatePct').value),
    otherItemizedDeductions: parseNumber(document.getElementById('otherItemizedDeductions').value),
    buyClosingPct: parseNumber(document.getElementById('buyClosingPct').value),
    sellClosingPct: parseNumber(document.getElementById('sellClosingPct').value),
    maintenancePct: parseNumber(document.getElementById('maintenancePct').value),
    homeInsurancePct: parseNumber(document.getElementById('homeInsurancePct').value),
    extraUtilitiesMonthly: parseNumber(document.getElementById('extraUtilitiesMonthly').value),
    hoaMonthly: parseNumber(document.getElementById('hoaMonthly').value),
    hoaDeductiblePct: parseNumber(document.getElementById('hoaDeductiblePct').value),
    securityDepositInitial: parseNumber(document.getElementById('securityDepositInitial').value),
    brokersFeePct: parseNumber(document.getElementById('brokersFeePct').value),
    rentersInsuranceInitial: parseNumber(document.getElementById('rentersInsuranceInitial').value),
    rentersInsuranceGrowthPct: 3, // Fixed at 3% (same as inflation)
    capitalGainsRatePct: parseNumber(document.getElementById('capitalGainsRatePct').value),
  };
}

function computeTotals(s){
  const downPayment = s.homePrice * pct(s.downPaymentPct);
  const loanAmount = s.homePrice - downPayment;
  const buyClosing = s.homePrice * pct(s.buyClosingPct);
  const amort = buildAmortization(loanAmount, s.mortgageRate, s.mortgageYears);
  const months = s.years*12;
  // Consider the full stay period. For months beyond the mortgage term,
  // mortgage payment/interest become zero but ongoing owner costs continue.
  const monthsConsidered = months;

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
    const row = amort[m] || { payment: 0, interest: 0, remaining: 0 };
    totalMortgagePayments += row.payment || 0;
    totalMortgageInterest += row.interest || 0;

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

    const monthlyGrossCashFlow = (row.payment || 0) + monthlyPMI + monthlyPropertyTax + monthlyMaintenance + monthlyHomeInsurance + monthlyHOA + monthlyUtilities;
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

  // Update summary copy
  const rawDiff = r.totalBuy - r.totalRent;
  const diff = Math.abs(rawDiff);
  const headline = `If you stay ${s.years} years,`;
  let sub, colorClass;
  if(diff <= 2000){
    sub = 'Renting and buying are equal.';
    colorClass = 'equal';
  }else if(rawDiff < 0){
    // Round to nearest thousand for display
    const roundedDiff = Math.round(diff / 1000) * 1000;
    sub = `Buying saves ${formatCurrency(roundedDiff)}.`;
    colorClass = 'buying';
  }else{
    // Round to nearest thousand for display
    const roundedDiff = Math.round(diff / 1000) * 1000;
    sub = `Renting saves ${formatCurrency(roundedDiff)}.`;
    colorClass = 'renting';
  }
  document.getElementById('winnerLabel').textContent = headline;
  const diffEl = document.getElementById('difference');
  diffEl.textContent = sub;
  diffEl.className = 'subhead ' + colorClass;

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
  const isNonlinear = slider.hasAttribute('data-nonlinear');

  // For non-linear sliders, we sample slider positions and convert to actual values
  // For linear sliders, we sample actual values directly
  
  // Find crossover by sampling with tolerance to avoid flicker
  const samples = 200;
  let lastSliderPos = min;
  let lastActualVal = isNonlinear ? sliderToValue(slider, min) : min;
  let lastTotals = computeTotalAtValue(targetId, lastActualVal);
  let lastBetter = lastTotals.buy + 1000 < lastTotals.rent; // 1k tolerance near equality
  let crossoverSliderPos = null;
  
  for(let i=1;i<=samples;i++){
    const sliderPos = min + (i*(max-min)/samples);
    const actualVal = isNonlinear ? sliderToValue(slider, sliderPos) : sliderPos;
    const totals = computeTotalAtValue(targetId, actualVal);
    const better = totals.buy + 1000 < totals.rent; // 1k tolerance
    if(better !== lastBetter){ 
      crossoverSliderPos = (lastSliderPos + sliderPos)/2; 
      break; 
    }
    lastSliderPos = sliderPos;
    lastActualVal = actualVal;
    lastBetter = better;
  }
  
  const crossPct = crossoverSliderPos === null ? 50 : ((crossoverSliderPos - min) / (max - min)) * 100;
  const firstActualVal = isNonlinear ? sliderToValue(slider, min) : min;
  const leftIsBuying = computeTotalAtValue(targetId, firstActualVal).buy < computeTotalAtValue(targetId, firstActualVal).rent;

  // Calculate sensitivity: how much does this input affect the result?
  // Sample at extremes and measure the difference
  const currentInputs = readInputs();
  const currentResult = computeTotals(currentInputs);
  const currentDiff = Math.abs(currentResult.totalBuy - currentResult.totalRent);
  
  let minActualVal = isNonlinear ? sliderToValue(slider, min) : min;
  let maxActualVal = isNonlinear ? sliderToValue(slider, max) : max;
  
  const testMinInputs = {...currentInputs, [targetId]: minActualVal};
  const testMaxInputs = {...currentInputs, [targetId]: maxActualVal};
  const minResult = computeTotals(testMinInputs);
  const maxResult = computeTotals(testMaxInputs);
  const minDiff = Math.abs(minResult.totalBuy - minResult.totalRent);
  const maxDiff = Math.abs(maxResult.totalBuy - maxResult.totalRent);
  
  // Sensitivity is the max change in outcome as a percentage of current outcome
  const maxChange = Math.max(Math.abs(minDiff - currentDiff), Math.abs(maxDiff - currentDiff));
  const sensitivity = currentDiff > 0 ? maxChange / currentDiff : 1;
  
  // Adjust color intensity based on sensitivity
  // High sensitivity (>0.5): full color intensity
  // Low sensitivity (<0.1): very muted (mostly gray)
  const colorIntensity = Math.min(1, Math.max(0.15, sensitivity));
  
  // Colors - adjust intensity
  const blue = {r:66,g:129,b:245};
  const purple = {r:149,g:88,b:246};
  const gray = {r:203,g:213,b:225};
  
  // Mix base colors toward gray based on sensitivity
  function adjustColorIntensity(color, intensity){
    return {
      r: Math.round(gray.r + (color.r - gray.r) * intensity),
      g: Math.round(gray.g + (color.g - gray.g) * intensity),
      b: Math.round(gray.b + (color.b - gray.b) * intensity)
    };
  }
  
  const adjustedBlue = adjustColorIntensity(blue, colorIntensity);
  const adjustedPurple = adjustColorIntensity(purple, colorIntensity);
  const baseLeft = leftIsBuying ? adjustedPurple : adjustedBlue;
  const baseRight = leftIsBuying ? adjustedBlue : adjustedPurple;

  function mix(c1,c2,t){ // t in [0,1], 0->c1,1->c2
    const r = Math.round(c1.r*(1-t) + c2.r*t);
    const g = Math.round(c1.g*(1-t) + c2.g*t);
    const b = Math.round(c1.b*(1-t) + c2.b*t);
    return `rgb(${r}, ${g}, ${b})`;
  }

  // Build piecewise gradient
  const pieces = 40; // number of squares
  const pieceWidth = 100 / pieces;
  
  // First pass: determine which option is better at each piece
  const pieceStates = [];
  for(let i=0;i<pieces;i++){
    const start = i*pieceWidth;
    const end = (i+1)*pieceWidth;
    const mid = (start + end)/2;

    // Sample at this position to determine which option is better
    const sampleSliderPos = min + (mid/100) * (max - min);
    let sampleActualVal = isNonlinear ? sliderToValue(slider, sampleSliderPos) : sampleSliderPos;
    // Force integer years for stability
    if(targetId === 'years' || targetId === 'mortgageYears') sampleActualVal = Math.round(sampleActualVal);
    const sampleResult = computeTotalAtValue(targetId, sampleActualVal);
    const isBuyingBetter = sampleResult.buy + 1000 < sampleResult.rent; // 1k tolerance to reduce noise
    const diff = Math.abs(sampleResult.buy - sampleResult.rent);
    
    pieceStates.push({ isBuyingBetter, diff });
  }
  const anyBuying = pieceStates.some(p=>p.isBuyingBetter);
  const anyRenting = pieceStates.some(p=>!p.isBuyingBetter);
  
  // Optional stabilization: for certain inputs like years, enforce at most one
  // crossover to avoid alternating bands due to tiny numerical wiggles.
  if(targetId === 'years'){
    let transitions = 0;
    for(let i=1;i<pieces;i++){
      if(pieceStates[i].isBuyingBetter !== pieceStates[i-1].isBuyingBetter) transitions++;
    }
    if(transitions > 1){
      const initial = pieceStates[0].isBuyingBetter;
      // Find span where the opposite state occurs
      let first = -1, last = -1;
      for(let i=0;i<pieces;i++){
        if(pieceStates[i].isBuyingBetter !== initial){
          if(first === -1) first = i;
          last = i;
        }
      }
      // Collapse to a single crossover midpoint
      const split = first === -1 ? pieces : Math.round((first + last)/2);
      for(let i=0;i<pieces;i++){
        pieceStates[i].isBuyingBetter = (i <= split) ? initial : !initial;
      }
    }
  }

  // Second pass: find crossover regions and apply colors
  const barPieces = slider._pieces || [];
  for(let i=0;i<pieces;i++){
    const state = pieceStates[i];
    
    // Check if this piece is near a crossover (adjacent pieces have different states)
    const prevState = i > 0 ? pieceStates[i-1] : state;
    const nextState = i < pieces-1 ? pieceStates[i+1] : state;
    const isNearCrossover = (prevState.isBuyingBetter !== state.isBuyingBetter) || 
                           (nextState.isBuyingBetter !== state.isBuyingBetter);
    
    // Find distance to nearest crossover
    let distToCrossover = pieces; // default to far away
    for(let j=0;j<pieces;j++){
      if(pieceStates[j].isBuyingBetter !== state.isBuyingBetter){
        distToCrossover = Math.min(distToCrossover, Math.abs(i - j));
      }
    }
    
    // Determine base color: if entire range is one side, lock to that color
    let base;
    if(anyBuying && !anyRenting){
      base = adjustedPurple;
    }else if(anyRenting && !anyBuying){
      base = adjustedBlue;
    }else{
      base = state.isBuyingBetter ? adjustedPurple : adjustedBlue;
    }
    
    let color;
    // Gray zone only very close to actual crossover
    if(!anyBuying || !anyRenting){
      // No crossover anywhere: pure color bars (no gray)
      color = `rgb(${base.r}, ${base.g}, ${base.b})`;
    }else if(distToCrossover === 0){
      color = `rgb(${gray.r}, ${gray.g}, ${gray.b})`;
    }else if(distToCrossover <= 6){
      // Fade from gray to full color over ~6 pieces
      const span = 6;
      const maxMix = 0.8; // first colored piece is 80% gray
      const t = (distToCrossover - 1) / (span - 1);
      const wGray = maxMix * (1 - t);
      color = mix(base, gray, Math.max(0, Math.min(1, wGray)));
    }else{
      // Full color when far from crossover
      color = `rgb(${base.r}, ${base.g}, ${base.b})`;
    }
    
    if(barPieces[i]){
      barPieces[i].style.backgroundColor = color;
    }
  }

  // Highlight the single piece closest to the thumb position
  const val = +slider.value;
  const ratio = (val - min) / (max - min);
  const barRect = (slider._bar && slider._bar.getBoundingClientRect) ? slider._bar.getBoundingClientRect() : null;
  const sliderRect = slider.getBoundingClientRect();
  let activeIndex = Math.max(0, Math.min(pieces-1, Math.floor(ratio * pieces + 1e-6)));
  if(barRect){
    const barWidth = Math.max(1, barRect.width);
    const pieceWpx = barWidth / pieces;
    const deltaLeft = sliderRect.left - barRect.left;
    const rootStyles = getComputedStyle(document.documentElement);
    const thumbWidth = parseFloat(rootStyles.getPropertyValue('--slider-thumb-w')) || 20;
    // thumb center relative to bar's left
    const thumbCenterX = ratio * (sliderRect.width - thumbWidth) + (thumbWidth/2) + deltaLeft;
    activeIndex = Math.max(0, Math.min(pieces-1, Math.floor(thumbCenterX / pieceWpx)));
  }
  barPieces.forEach((el, idx)=>{
    if(!el) return;
    if(idx === activeIndex) el.classList.add('active');
    else el.classList.remove('active');
  });
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
  // Ensure segmented bars exist above each slider
  sliders.forEach(slider=>{
    if(slider._segmentedInit) return;
    const group = slider.closest('.input-group');
    if(!group) return;
    const bar = document.createElement('div');
    bar.className = 'segmented-bar';
    const pieces = [];
    for(let i=0;i<40;i++){
      const d = document.createElement('div');
      d.className = 'piece';
      bar.appendChild(d);
      pieces.push(d);
    }
    group.insertBefore(bar, slider);
    
    // Add labels below slider with midpoints
    const labels = document.createElement('div');
    labels.className = 'slider-labels';
    const targetId = slider.getAttribute('data-target');
    const minVal = parseNumber(slider.min);
    const maxVal = parseNumber(slider.max);
    const isNonlinear = slider.hasAttribute('data-nonlinear');
    
    // Determine which labels to show based on the slider
    const labelValues = getMidpointLabels(targetId, minVal, maxVal);
    
    labelValues.forEach(val => {
      const label = document.createElement('span');
      label.textContent = formatSliderLabel(targetId, val);
      
      // Calculate position based on where this value falls on the slider
      let position;
      if(isNonlinear){
        // Convert actual value to slider position (0-100), then to percentage
        const sliderPos = valueToSlider(slider, val);
        position = ((sliderPos - minVal) / (maxVal - minVal)) * 100;
      }else{
        // Linear: direct percentage
        position = ((val - minVal) / (maxVal - minVal)) * 100;
      }
      
      label.style.left = position + '%';
      labels.appendChild(label);
    });
    
    // Insert labels after slider
    if(slider.nextSibling){
      group.insertBefore(labels, slider.nextSibling);
    }else{
      group.appendChild(labels);
    }
    
    slider._bar = bar;
    slider._pieces = pieces;
    slider._labels = labels;
    slider._segmentedInit = true;
  });
  sliders.forEach(slider=>{
    const targetId = slider.getAttribute('data-target');
    const targetInput = document.getElementById(targetId);
    
    if(targetInput){
      // Slider changes number input
      slider.addEventListener('input', ()=>{
        const sliderPos = parseNumber(slider.value);
        const actualValue = sliderToValue(slider, sliderPos);
        targetInput.value = formatInputValue(targetId, actualValue);
        targetInput.dataset.rawValue = String(actualValue);
        computeBuyVsRent();
        updateAllSliderGradients();
      });
      
      // Number input changes slider
      targetInput.addEventListener('input', ()=>{
        const val = parseNumber(targetInput.value);
        const sliderPos = valueToSlider(slider, val);
        slider.value = String(sliderPos);
        targetInput.dataset.rawValue = String(val);
        computeBuyVsRent();
        updateAllSliderGradients();
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

function attachInputFormatting(){
  // Format all number inputs with their appropriate styles
  const allInputs = document.querySelectorAll('input[type="number"], input[type="text"]');
  allInputs.forEach(input=>{
    const id = input.id;
    if(!id) return;
    
    // Convert to text input to allow custom formatting
    input.type = 'text';
    input.inputMode = 'numeric';
    
    // On input, just parse and update (keep formatting)
    input.addEventListener('input', ()=>{
      const n = parseNumber(input.value);
      // Store raw value on the element for easy access
      input.dataset.rawValue = String(n);
    });
    
    // On blur, format properly
    input.addEventListener('blur', ()=>{
      const n = parseNumber(input.value);
      input.value = formatInputValue(id, n);
      input.dataset.rawValue = String(n);
    });
    
    // Initialize with formatted value
    const initialValue = parseNumber(input.value);
    input.value = formatInputValue(id, initialValue);
    input.dataset.rawValue = String(initialValue);
  });
}

window.addEventListener('DOMContentLoaded', ()=>{
  hookInputs();
  attachInputFormatting();
  
  // Initialize non-linear sliders to correct positions
  document.querySelectorAll('input[type="range"].slider[data-nonlinear]').forEach(slider => {
    const targetId = slider.getAttribute('data-target');
    const targetInput = document.getElementById(targetId);
    if(targetInput){
      const currentValue = parseNumber(targetInput.value);
      const sliderPos = valueToSlider(slider, currentValue);
      slider.value = String(sliderPos);
    }
  });
  
  computeBuyVsRent();
  
  // Fix initial slider gradient alignment after a brief delay to ensure DOM is ready
  setTimeout(() => {
    updateAllSliderGradients();
  }, 50);
});
