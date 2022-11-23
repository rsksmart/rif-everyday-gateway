import { Contract } from 'ethers';
import hre, { ethers } from 'hardhat';
import StandardTokenJSON from './tropykusCompiledContracts/StandardToken.json';
import MultiSigWalletJSON from './tropykusCompiledContracts/MultiSigWallet.json';
import PriceOracleProxyJSON from './tropykusCompiledContracts/PriceOracleProxy.json';
import UnitrollerJSON from './tropykusCompiledContracts/Unitroller.json';
import ComptrollerG6JSON from './tropykusCompiledContracts/ComptrollerG6.json';
import MockProviderMOCJSON from './tropykusCompiledContracts/MockPriceProviderMoC.json';
import PriceOracleAdapterMOCJSON from './tropykusCompiledContracts/PriceOracleAdapterMoc.json';
import WhitePaperInterestRateJSON from './tropykusCompiledContracts/WhitePaperInterestRateModel.json';
import JumpRateModelV2JSON from './tropykusCompiledContracts/JumpRateModelV2.json';
import HurricaneRateInterestModelJSON from './tropykusCompiledContracts/HurricaneInterestRateModel.json';
import CErc20ImmutableJSON from './tropykusCompiledContracts/CErc20Immutable.json';
import CRBTCJSON from './tropykusCompiledContracts/CRBTC.json';
import CRBTCCompanionJSON from './tropykusCompiledContracts/CRBTCCompanion.json';
import CRDOCJSON from './tropykusCompiledContracts/CRDOC.json';
import TropykusLensJSON from './tropykusCompiledContracts/TropykusLens.json';

export const tropykusFixture = async () => {
  const tropykusContracts = await deployTropykusContracts();

  return tropykusContracts;
};

export const deployTropykusContracts = async () => {
  const [deployer] = await ethers.getSigners();
  const parseEther = ethers.utils.parseEther;
  const config = {
    initialExchangeRateMantissa: parseEther('0.02'),
    liquidationIncentiveMantissa: parseEther('0.07'),
    closeFactorMantissa: parseEther('0.5'),
    compSpeed: 0,
    markets: {
      rif: {
        reserveFactor: parseEther('0.2'),
        collateralFactor: parseEther('0.5'),
        baseBorrowRate: parseEther('0.015'),
        multiplier: parseEther('0.01'),
      },
      doc: {
        reserveFactor: parseEther('0.05'),
        collateralFactor: parseEther('0.8'),
        baseBorrowRate: parseEther('0.0125'),
        multiplier: parseEther('0.11'),
        jumpMultiplier: parseEther('0.7'),
        kink: parseEther('0.9'),
      },
      rdoc: {
        reserveFactor: parseEther('0.50'),
        collateralFactor: parseEther('0.75'),
        baseBorrowRate: parseEther('0.001'),
        multiplier: parseEther('0.00470588235'),
        jumpMultiplier: parseEther('0.00588'),
        kink: parseEther('0.85'),
      },
      usdt: {
        reserveFactor: parseEther('0.07'),
        collateralFactor: parseEther('0.8'),
        baseBorrowRate: parseEther('0.0125'),
        multiplier: parseEther('0.05'),
        jumpMultiplier: parseEther('0.7'),
        kink: parseEther('0.8'),
      },
      rbtc: {
        reserveFactor: parseEther('0.20'),
        collateralFactor: parseEther('0.6'),
        baseBorrowRate: parseEther('0.04'),
        multiplier: parseEther('0.1'),
      },
      sat: {
        reserveFactor: parseEther('0.30'),
        collateralFactor: parseEther('0.50'),
        baseBorrowRate: parseEther('0.08'),
        promisedBaseReturnRate: parseEther('0.04'),
        optimal: parseEther('0.5'),
        borrowRateSlope: parseEther('0.04'),
        supplyRateSlope: parseEther('0.02'),
        initialSubsidy: parseEther('0.05'),
      },
    },
  };

  const chainId = await getChainId(
    hre.network.config.chainId?.toString() || '1337'
  );

  const multiSigWalletContract = new ethers.ContractFactory(
    MultiSigWalletJSON.abi,
    MultiSigWalletJSON.bytecode,
    deployer
  );
  const multiSig = await multiSigWalletContract.deploy([deployer.address], 1);
  await multiSig.deployTransaction.wait();

  const priceOracleProxyContract = new ethers.ContractFactory(
    PriceOracleProxyJSON.abi,
    PriceOracleProxyJSON.bytecode,
    deployer
  );
  const priceOracleProxyDeploy = await priceOracleProxyContract.deploy(
    deployer.address
  );
  await priceOracleProxyDeploy.deployTransaction.wait();

  const unitrollerContract = new ethers.ContractFactory(
    UnitrollerJSON.abi,
    UnitrollerJSON.bytecode,
    deployer
  );

  const unitrollerDeployed = await unitrollerContract.deploy();
  await unitrollerDeployed.deployTransaction.wait();
  const comptrollerContract = new ethers.ContractFactory(
    ComptrollerG6JSON.abi,
    ComptrollerG6JSON.bytecode,
    deployer
  );
  ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.OFF);
  const comptrollerDeployed = await comptrollerContract.deploy();
  ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.INFO);

  await comptrollerDeployed.deployTransaction.wait();

  const standardTokenContract = new ethers.ContractFactory(
    StandardTokenJSON.abi,
    StandardTokenJSON.bytecode,
    deployer
  );

  const rifToken = await standardTokenContract.deploy(
    parseEther('2000000'),
    'Test RIF Tropykus',
    18,
    'tRIF'
  );
  await rifToken.deployTransaction.wait();

  const docToken = await standardTokenContract.deploy(
    parseEther('2000000'),
    'Test DOC Tropykus',
    18,
    'tDOC'
  );
  await docToken.deployTransaction.wait();

  const rdocToken = await standardTokenContract.deploy(
    parseEther('2000000'),
    'Test RDOC Tropykus',
    18,
    'tRDOC'
  );
  await rdocToken.deployTransaction.wait();

  const usdtToken = await standardTokenContract.deploy(
    parseEther('2000000'),
    'Test rUSDT Tropykus',
    18,
    'trUSDT'
  );
  await usdtToken.deployTransaction.wait();

  const mockPriceProviderMoC = new ethers.ContractFactory(
    MockProviderMOCJSON.abi,
    MockProviderMOCJSON.bytecode,
    deployer
  );

  const rifOracle = await mockPriceProviderMoC.deploy(
    deployer.address,
    parseEther('0.252')
  );
  await rifOracle.deployTransaction.wait();

  const rbtcOracle = await mockPriceProviderMoC.deploy(
    deployer.address,
    parseEther('54556.9')
  );
  await rbtcOracle.deployTransaction.wait();

  const docOracle = await mockPriceProviderMoC.deploy(
    deployer.address,
    parseEther('1')
  );
  await docOracle.deployTransaction.wait();

  const rdocOracle = await mockPriceProviderMoC.deploy(
    deployer.address,
    parseEther('1')
  );
  await rdocOracle.deployTransaction.wait();

  const usdtOracle = await mockPriceProviderMoC.deploy(
    deployer.address,
    parseEther('1')
  );
  await usdtOracle.deployTransaction.wait();

  const priceOracleAdapterMoc = new ethers.ContractFactory(
    PriceOracleAdapterMOCJSON.abi,
    PriceOracleAdapterMOCJSON.bytecode,
    deployer
  );
  const rbtcPriceOracleAdapterMoC = await priceOracleAdapterMoc.deploy(
    deployer.address,
    rbtcOracle.address
  );
  await rbtcPriceOracleAdapterMoC.deployTransaction.wait();

  const satPriceOracleAdapterMoC = await priceOracleAdapterMoc.deploy(
    deployer.address,
    rbtcOracle.address
  );
  await satPriceOracleAdapterMoC.deployTransaction.wait();

  const rifPriceOracleAdapterMoC = await priceOracleAdapterMoc.deploy(
    deployer.address,
    rifOracle.address
  );
  await rifPriceOracleAdapterMoC.deployTransaction.wait();

  const docPriceOracleAdapterMoC = await priceOracleAdapterMoc.deploy(
    deployer.address,
    docOracle.address
  );
  await docPriceOracleAdapterMoC.deployTransaction.wait();

  const rdocPriceOracleAdapterMoC = await priceOracleAdapterMoc.deploy(
    deployer.address,
    rdocOracle.address
  );
  await rdocPriceOracleAdapterMoC.deployTransaction.wait();

  const usdtPriceOracleAdapterMoC = await priceOracleAdapterMoc.deploy(
    deployer.address,
    usdtOracle.address
  );

  await usdtPriceOracleAdapterMoC.deployTransaction.wait();

  const whitePaperInterestRateModel = new ethers.ContractFactory(
    WhitePaperInterestRateJSON.abi,
    WhitePaperInterestRateJSON.bytecode,
    deployer
  );
  const jumpInterestRateModelV2 = new ethers.ContractFactory(
    JumpRateModelV2JSON.abi,
    JumpRateModelV2JSON.bytecode,
    deployer
  );
  const hurricaneInterestRateModel = new ethers.ContractFactory(
    HurricaneRateInterestModelJSON.abi,
    HurricaneRateInterestModelJSON.bytecode,
    deployer
  );

  const { rif, doc, rdoc, usdt, rbtc, sat } = config.markets;
  const rifInterestRateModel = await whitePaperInterestRateModel.deploy(
    rif.baseBorrowRate,
    rif.multiplier
  );
  await rifInterestRateModel.deployTransaction.wait();

  const docInterestRateModel = await jumpInterestRateModelV2.deploy(
    doc.baseBorrowRate,
    doc.multiplier,
    doc.jumpMultiplier,
    doc.kink,
    deployer.address
  );
  await docInterestRateModel.deployTransaction.wait();

  const rdocInterestRateModel = await jumpInterestRateModelV2.deploy(
    rdoc.baseBorrowRate,
    rdoc.multiplier,
    rdoc.jumpMultiplier,
    rdoc.kink,
    deployer.address
  );
  await rdocInterestRateModel.deployTransaction.wait();

  const usdtInterestRateModel = await jumpInterestRateModelV2.deploy(
    usdt.baseBorrowRate,
    usdt.multiplier,
    usdt.jumpMultiplier,
    usdt.kink,
    deployer.address
  );
  await usdtInterestRateModel.deployTransaction.wait();

  const rbtcInterestRateModel = await whitePaperInterestRateModel.deploy(
    rbtc.baseBorrowRate,
    rbtc.multiplier
  );
  await rbtcInterestRateModel.deployTransaction.wait();

  const satInterestRateModel = await hurricaneInterestRateModel.deploy(
    sat.baseBorrowRate,
    sat.promisedBaseReturnRate,
    sat.optimal,
    sat.borrowRateSlope,
    sat.supplyRateSlope
  );
  await satInterestRateModel.deployTransaction.wait();

  const cErc20Immutable = new ethers.ContractFactory(
    CErc20ImmutableJSON.abi,
    CErc20ImmutableJSON.bytecode,
    deployer
  );
  const cRBTCContract = new ethers.ContractFactory(
    CRBTCJSON.abi,
    CRBTCJSON.bytecode,
    deployer
  );
  const cRBTCCompanionContract = new ethers.ContractFactory(
    CRBTCCompanionJSON.abi,
    CRBTCCompanionJSON.bytecode,
    deployer
  );
  const cRDOCContract = new ethers.ContractFactory(
    CRDOCJSON.abi,
    CRDOCJSON.bytecode,
    deployer
  );

  const cRIFdeployed = await cErc20Immutable.deploy(
    rifToken.address,
    comptrollerDeployed.address,
    rifInterestRateModel.address,
    config.initialExchangeRateMantissa,
    'Tropykus kRIF',
    'kRIF',
    18,
    deployer.address
  );
  await cRIFdeployed.deployTransaction.wait();

  const cDOCdeployed = await cErc20Immutable.deploy(
    docToken.address,
    comptrollerDeployed.address,
    docInterestRateModel.address,
    config.initialExchangeRateMantissa,
    'Tropykus kDOC',
    'kDOC',
    18,
    deployer.address
  );
  await cDOCdeployed.deployTransaction.wait();

  const cRDOCdeployed = await cRDOCContract.deploy(
    rdocToken.address,
    comptrollerDeployed.address,
    rdocInterestRateModel.address,
    config.initialExchangeRateMantissa,
    'Tropykus kRDOC',
    'kRDOC',
    18,
    deployer.address
  );
  await cRDOCdeployed.deployTransaction.wait();

  const cUSDTdeployed = await cErc20Immutable.deploy(
    usdtToken.address,
    comptrollerDeployed.address,
    usdtInterestRateModel.address,
    config.initialExchangeRateMantissa,
    'Tropykus kUSDT',
    'kUSDT',
    18,
    deployer.address
  );
  await cUSDTdeployed.deployTransaction.wait();

  const cRBTCdeployed = await cRBTCContract.deploy(
    comptrollerDeployed.address,
    rbtcInterestRateModel.address,
    config.initialExchangeRateMantissa,
    'Tropykus kRBTC',
    'kRBTC',
    18,
    deployer.address
  );
  await cRBTCdeployed.deployTransaction.wait();

  const cSATdeployed = await cRBTCContract.deploy(
    comptrollerDeployed.address,
    satInterestRateModel.address,
    config.initialExchangeRateMantissa,
    'Tropykus kSAT',
    'kSAT',
    18,
    deployer.address
  );
  await cSATdeployed.deployTransaction.wait();

  const cRBTCCompanionDeployed = await cRBTCCompanionContract.deploy(
    comptrollerDeployed.address,
    cSATdeployed.address,
    priceOracleProxyDeploy.address
  );
  await cRBTCCompanionDeployed.deployTransaction.wait();

  const tropykusLensContract = new ethers.ContractFactory(
    TropykusLensJSON.abi,
    TropykusLensJSON.bytecode,
    deployer
  );
  const tropykusLens = await tropykusLensContract.deploy();
  await tropykusLens.deployTransaction.wait();

  const unitroller = new ethers.Contract(
    unitrollerDeployed.address,
    UnitrollerJSON.abi,
    deployer
  );

  ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.OFF);
  const comptroller = new ethers.Contract(
    comptrollerDeployed.address,
    ComptrollerG6JSON.abi,
    deployer
  );
  ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.INFO);

  await unitroller
    ._setPendingImplementation(comptroller.address)
    .then((tx: { wait: () => any }) => tx.wait());
  await comptroller
    ._become(unitroller.address)
    .then((tx: { wait: () => any }) => tx.wait());
  await comptroller
    ._setPriceOracle(priceOracleProxyDeploy.address)
    .then((tx: { wait: () => any }) => tx.wait());
  await comptroller
    ._setCloseFactor(config.closeFactorMantissa)
    .then((tx: { wait: () => any }) => tx.wait());
  await comptroller
    ._setLiquidationIncentive(config.liquidationIncentiveMantissa)
    .then((tx: { wait: () => any }) => tx.wait());

  const priceOracleProxy = new ethers.Contract(
    priceOracleProxyDeploy.address,
    PriceOracleProxyJSON.abi,
    deployer
  );

  await priceOracleProxy
    .setAdapterToToken(cRIFdeployed.address, rifPriceOracleAdapterMoC.address)
    .then((tx: { wait: () => any }) => tx.wait());
  await priceOracleProxy
    .setAdapterToToken(cDOCdeployed.address, docPriceOracleAdapterMoC.address)
    .then((tx: { wait: () => any }) => tx.wait());
  await priceOracleProxy
    .setAdapterToToken(cRDOCdeployed.address, rdocPriceOracleAdapterMoC.address)
    .then((tx: { wait: () => any }) => tx.wait());
  await priceOracleProxy
    .setAdapterToToken(cUSDTdeployed.address, usdtPriceOracleAdapterMoC.address)
    .then((tx: { wait: () => any }) => tx.wait());
  await priceOracleProxy
    .setAdapterToToken(cRBTCdeployed.address, rbtcPriceOracleAdapterMoC.address)
    .then((tx: { wait: () => any }) => tx.wait());
  await priceOracleProxy
    .setAdapterToToken(cSATdeployed.address, satPriceOracleAdapterMoC.address)
    .then((tx: { wait: () => any }) => tx.wait());

  await comptroller
    ._supportMarket(cRIFdeployed.address)
    .then((tx: { wait: () => any }) => tx.wait());
  await comptroller
    ._supportMarket(cDOCdeployed.address)
    .then((tx: { wait: () => any }) => tx.wait());
  await comptroller
    ._supportMarket(cRDOCdeployed.address)
    .then((tx: { wait: () => any }) => tx.wait());
  await comptroller
    ._supportMarket(cUSDTdeployed.address)
    .then((tx: { wait: () => any }) => tx.wait());
  await comptroller
    ._supportMarket(cRBTCdeployed.address)
    .then((tx: { wait: () => any }) => tx.wait());
  await comptroller
    ._supportMarket(cSATdeployed.address)
    .then((tx: { wait: () => any }) => tx.wait());

  await comptroller
    ._setCollateralFactor(cRIFdeployed.address, rif.collateralFactor)
    .then((tx: { wait: () => any }) => tx.wait());
  await comptroller
    ._setCollateralFactor(cDOCdeployed.address, doc.collateralFactor)
    .then((tx: { wait: () => any }) => tx.wait());
  await comptroller
    ._setCollateralFactor(cRDOCdeployed.address, rdoc.collateralFactor)
    .then((tx: { wait: () => any }) => tx.wait());
  await comptroller
    ._setCollateralFactor(cUSDTdeployed.address, usdt.collateralFactor)
    .then((tx: { wait: () => any }) => tx.wait());
  await comptroller
    ._setCollateralFactor(cRBTCdeployed.address, rbtc.collateralFactor)
    .then((tx: { wait: () => any }) => tx.wait());
  await comptroller
    ._setCollateralFactor(cSATdeployed.address, sat.collateralFactor)
    .then((tx: { wait: () => any }) => tx.wait());

  await comptroller._setCompRate(config.compSpeed);

  const cRIF = new ethers.Contract(
    cRIFdeployed.address,
    CErc20ImmutableJSON.abi,
    deployer
  );

  const cDOC = new ethers.Contract(
    cDOCdeployed.address,
    CErc20ImmutableJSON.abi,
    deployer
  );

  const cRDOC = new ethers.Contract(
    cRDOCdeployed.address,
    CErc20ImmutableJSON.abi,
    deployer
  );

  const cUSDT = new ethers.Contract(
    cUSDTdeployed.address,
    CErc20ImmutableJSON.abi,
    deployer
  );

  const cRBTC = new ethers.Contract(
    cRBTCdeployed.address,
    CRBTCJSON.abi,
    deployer
  );

  const cSAT = new ethers.Contract(
    cSATdeployed.address,
    CRBTCJSON.abi,
    deployer
  );

  await cRIF
    ._setReserveFactor(rif.reserveFactor)
    .then((tx: { wait: () => any }) => tx.wait());
  await cDOC
    ._setReserveFactor(doc.reserveFactor)
    .then((tx: { wait: () => any }) => tx.wait());
  await cRDOC
    ._setReserveFactor(rdoc.reserveFactor)
    .then((tx: { wait: () => any }) => tx.wait());
  await cUSDT
    ._setReserveFactor(usdt.reserveFactor)
    .then((tx: { wait: () => any }) => tx.wait());
  await cRBTC
    ._setReserveFactor(rbtc.reserveFactor)
    .then((tx: { wait: () => any }) => tx.wait());
  await cSAT
    ._setReserveFactor(sat.reserveFactor)
    .then((tx: { wait: () => any }) => tx.wait());
  await cSAT
    .addSubsidy({ value: sat.initialSubsidy })
    .then((tx: { wait: () => any }) => tx.wait());

  const crbtcCompanion = new ethers.Contract(
    cRBTCCompanionDeployed.address,
    CRBTCCompanionJSON.abi,
    deployer
  );

  await crbtcCompanion
    .setMarketCapThreshold(parseEther('0.8'))
    .then((tx: { wait: () => any }) => tx.wait());
  await cSAT
    .setCompanion(crbtcCompanion.address)
    .then((tx: { wait: () => any }) => tx.wait());

  // Supply DOC to the cDOC contract
  await (
    await docToken.functions['transfer(address,uint256)'](
      cDOC.address,
      parseEther('1000')
    )
  ).wait();

  // Supply rBTC to the cRBTC contract
  await (
    await cRBTC.functions['mint()']({
      value: ethers.utils.parseEther('1'),
    })
  ).wait();

  return {
    comptroller: comptrollerDeployed.address,
    oracle: priceOracleProxyDeploy.address,
    crbtc: cRBTCdeployed.address,
    cdoc: cDOCdeployed.address,
    doc: docToken.address,
  };
};

const getChainId = (chainName: string) => {
  switch (chainName) {
    case 'rskmainnet':
      return 30;
    case 'rsktestnet':
      return 31;
    case 'rskregtest':
      return 33;
    case 'ganache':
      return 1337;
    case 'hardhat':
      return 1337;
    default:
      return 'Unknown';
  }
};
