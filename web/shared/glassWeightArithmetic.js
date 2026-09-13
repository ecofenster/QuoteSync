// Shared by the existing glass tool and evidence-gated installation estimates.
export function calculatePaneWeights(areaM2,thicknessesMm){
  const paneWeights=thicknessesMm.map(thickness=>areaM2*(thickness/1000)*2500);
  const total=paneWeights.reduce((sum,value)=>sum+value,0);
  return {paneWeights,total,avg:paneWeights.length?total/paneWeights.length:0};
}
