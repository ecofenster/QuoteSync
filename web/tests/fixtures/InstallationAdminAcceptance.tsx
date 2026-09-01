import { createRoot } from "react-dom/client";
import CalculatorAdminCatalogue from "../../src/features/projectCalculatorLab/CalculatorAdminCatalogue";
import { projectCalculatorLabApi } from "../../src/features/projectCalculatorLab/api/projectCalculatorLabApi";
import { CALCULATOR_CATALOGUE_DEFAULTS, CALCULATION_RULE_DEFAULTS, PACKAGE_RULE_DEFAULTS } from "../../server/features/projectCalculatorLab/calculatorCatalogueDefaults.js";
import type { CalculatorAdminConfiguration } from "../../src/features/projectCalculatorLab/domain/projectCalculatorLab.types";
import "../../src/index.css";
import "../../src/features/projectCalculatorLab/projectCalculatorLab.css";

const config: CalculatorAdminConfiguration = {
  catalogue: CALCULATOR_CATALOGUE_DEFAULTS.map((item: any) => ({ id:item[0], category:item[1], label:item[2], rateType:item[3], priceAmount:item[4], currency:"GBP", variant:item[5]??{}, supplier:item[5]?.manufacturer??null, notes:null, active:true, version:1 })),
  rules: Object.fromEntries(Object.entries(CALCULATION_RULE_DEFAULTS).map(([key, value]) => [key, { value, version:1 }])),
  packageRules: Object.fromEntries(Object.entries(PACKAGE_RULE_DEFAULTS).map(([key, inclusions]) => [key, { inclusions:[...inclusions], version:1 }])),
};
projectCalculatorLabApi.getAdminConfiguration = async () => config;
projectCalculatorLabApi.getInstallationWorkforce = async () => ({ companies:[], installers:[], teams:[], capabilities:[] });
projectCalculatorLabApi.updateRule = async (_key, value) => ({ ...config, rules:{ ...config.rules, installation_materials_v1:{ value, version:2 } } });
projectCalculatorLabApi.createCatalogueItem = async () => config;
projectCalculatorLabApi.updateCatalogueItem = async () => config;
projectCalculatorLabApi.removeCatalogueItem = async id => ({ configuration:config, disposition:"deleted", dependencies:{ itemId:id, snapshotReferenceCount:0, scenarioIds:[], snapshotsAreSelfContained:true, liveForeignKeyReferenceCount:0 } });

createRoot(document.getElementById("root")!).render(<main className="app-main-workspace"><CalculatorAdminCatalogue /></main>);
