export const CALCULATOR_CATALOGUE_DEFAULTS=Object.freeze([
  ['survey','service','Survey','fixed_fee',null],['installation_support','service','Installation Support','fixed_fee',null],
  ['installer_mileage','travel','Installer mileage','per_mile','0.55'],['supplier_site_mileage','travel','Supplier / site-visit mileage','per_mile','0.55'],
  ['bnb','accommodation','B&B','per_person_night','100.00'],['hotel','accommodation','Hotel','per_person_night','150.00'],['airbnb','accommodation','Airbnb','per_crew_week','750.00'],
  ['food_allowance','accommodation','Food allowance','per_person_day','30.00'],['stay_away_allowance','accommodation','Staying-away allowance','per_person_night','50.00'],
  ['mini_spider_crane','mechanical_lifting','Mini spider crane','hire',null],['glass_vacuum_lifter','mechanical_lifting','Glass vacuum lifter','hire',null],['glazing_robot','mechanical_lifting','Glazing robot','hire',null],
  ['skip_4_yard','skip','4-yard skip','each',null],['skip_6_yard','skip','6-yard skip','each',null],['skip_8_yard','skip','8-yard skip','each',null],['skip_12_yard','skip','12-yard skip','each',null],
  ['tp600_unconfigured','illbruck_tp600','Illbruck TP600 — variant requires reference data','roll',null],
  ['me508_501392','illbruck_me508','Illbruck ME508 501392 · EW-70 · 75 m · 1 roll/box','box',null,{itemNumber:'501392',productName:'Illbruck ME508',role:'internal window/door membrane',rollLengthM:75,rollWidthCode:'EW-70',rollWidthMm:70,rollsPerBox:1,membraneThicknessMm:0.5,pricingUnit:'box'}],
  ['me508_501393','illbruck_me508','Illbruck ME508 501393 · EW-100 · 75 m · 1 roll/box','box',null,{itemNumber:'501393',productName:'Illbruck ME508',role:'internal window/door membrane',rollLengthM:75,rollWidthCode:'EW-100',rollWidthMm:100,rollsPerBox:1,membraneThicknessMm:0.5,pricingUnit:'box'}],
  ['me508_500252','illbruck_me508','Illbruck ME508 500252 · EW-140 · 25 m · 2 rolls/box','box',null,{itemNumber:'500252',productName:'Illbruck ME508',role:'internal window/door membrane',rollLengthM:25,rollWidthCode:'EW-140',rollWidthMm:140,rollsPerBox:2,membraneThicknessMm:0.5,pricingUnit:'box'}],
  ['me508_500290','illbruck_me508','Illbruck ME508 500290 · EW-200 · 25 m · 1 roll/box','box',null,{itemNumber:'500290',productName:'Illbruck ME508',role:'internal window/door membrane',rollLengthM:25,rollWidthCode:'EW-200',rollWidthMm:200,rollsPerBox:1,membraneThicknessMm:0.5,pricingUnit:'box'}],
  ['me508_500540','illbruck_me508','Illbruck ME508 500540 · EW-250 · 25 m · 1 roll/box','box',null,{itemNumber:'500540',productName:'Illbruck ME508',role:'internal window/door membrane',rollLengthM:25,rollWidthCode:'EW-250',rollWidthMm:250,rollsPerBox:1,membraneThicknessMm:0.5,pricingUnit:'box'}],
  ['tp601_unconfigured','illbruck_tp601','Illbruck TP601 — variant requires reference data','roll',null],
  ['bracket_unconfigured','bracket','Bracket type requires Admin configuration','pack',null],
]);

export const CALCULATION_RULE_DEFAULTS=Object.freeze({
  new_build_units_per_day_two_person:'7',refurbishment_units_per_day_two_person:'3',waste_percent:'10',
  day_one_installation_output:'0',target_return_home:'18:00',latest_return_home:'23:00',
  ggf_2016_replacement_pvcu_baseline:{name:'GGF 2016 Replacement PVC-U Baseline',version:1,advisory:true,applicability:{projectTypes:['refurbishment'],frameMaterials:['PVC-U'],regions:['England','Wales'],excluded:['new_build','aluminium','timber','steel','curtain_walling','specialist_sliding','bifold','Scotland']},source:{name:'GGF: A Guide to Good Practice — Installation of Replacement Windows and Doors',edition:'April 2016',section:'3.15.1 PVC-U windows and doors',url:'https://www.ggf.org.uk/wp-content/uploads/securepdfs/2018/06/20.3-Window-and-Door-GPG-April-2016.pdf'},rules:{secureAllFourSidesWherePossible:true,cornerOffsetMinMm:150,cornerOffsetMaxMm:250,mullionTransomExclusionMm:150,maxIntermediateSpacingMm:600,minimumFixingsPerJamb:2,headSillWidthBands:[{maxWidthMm:1200,intermediatePerSide:0},{minWidthMm:1201,maxWidthMm:2400,intermediatePerSide:1},{minWidthMm:2401,maxWidthMm:3600,intermediatePerSide:2}],aboveWidthMmRequiresReview:3600}},
});

export const PACKAGE_RULE_DEFAULTS=Object.freeze({
  supply_only:['products','extras','transport'],
  support:['products','extras','transport','survey','installation_support','travel'],
  full_installation:['products','extras','transport','installation','sealing','brackets','mechanical_lifting','travel','accommodation','skip'],
});
