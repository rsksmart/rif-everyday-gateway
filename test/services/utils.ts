import { BigNumber, Contract } from 'ethers';
import { ethers } from 'hardhat';
import {
  BORROW_SERVICE_INTERFACEID,
  LENDING_SERVICE_INTERFACEID,
} from 'test/utils/interfaceIDs';
import {
  FeeManager,
  IFeeManager,
  IGatewayAccessControl,
  IRIFGateway,
  RIFGateway,
  ServiceTypeManager,
  SubscriptionReporter,
} from 'typechain-types';
import { deployContract, deployProxyContract } from 'utils/deployment.utils';

export async function deployRIFGateway(
  registerInterfaceId = true,
  registerOwner = true
) {
  // Deploy Service Type Manager
  const { contract: serviceTypeManager } =
    await deployContract<ServiceTypeManager>('ServiceTypeManager', {});

  if (registerInterfaceId) {
    // allow lending service interface id
    const tLx = await serviceTypeManager.addServiceType(
      LENDING_SERVICE_INTERFACEID
    );
    await tLx.wait();

    // allow borrowing service interface id
    const tBx = await serviceTypeManager.addServiceType(
      BORROW_SERVICE_INTERFACEID
    );
    await tBx.wait();
  }

  // Deploy access control
  const { contract: gatewayAccessControl } =
    await deployContract<IGatewayAccessControl>('GatewayAccessControl', {});

  // Deploy FeeManager
  const feeManager = await deployFeeManager();

  const RIFGatewayIface = new ethers.utils.Interface([
    'function initialize(address serviceTypeManagerAddr,address gatewayAccessControlAddr, address feeManagerAddr)',
  ]);

  const RIFGatewayInitMsgData = RIFGatewayIface.encodeFunctionData(
    'initialize',
    [
      serviceTypeManager.address,
      gatewayAccessControl.address,
      feeManager.address,
    ]
  );

  const { contract: rifGateway } = await deployProxyContract<
    RIFGateway,
    IRIFGateway
  >('RIFGateway', 'RIFGatewayLogicV1', RIFGatewayInitMsgData);

  return {
    RIFGateway: rifGateway,
    feeManager,
    serviceTypeManager,
    gatewayAccessControl,
  };
}

export async function deployFeeManager() {
  // Deploy Fee Manager
  const feeManagerIface = new ethers.utils.Interface(['function initialize()']);
  const feeManagerMsgData = feeManagerIface.encodeFunctionData(
    'initialize',
    []
  );
  const { contract: feeManager } = await deployProxyContract<
    FeeManager,
    IFeeManager
  >('FeeManager', 'FeeManagerLogicV1', feeManagerMsgData);

  return feeManager;
}

export function toSmallNumber(bn: BigNumber, divisor = 1e18) {
  return +bn / divisor;
}
