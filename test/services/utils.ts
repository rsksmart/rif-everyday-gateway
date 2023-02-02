import { BigNumber, Contract } from 'ethers';
import { ethers } from 'hardhat';
import {
  BORROW_SERVICE_INTERFACEID,
  LENDING_SERVICE_INTERFACEID,
} from 'test/utils/interfaceIDs';
import {
  IRIFGateway,
  RIFGateway,
  ServiceTypeManager,
  SubscriptionReporter,
} from 'typechain-types';
import { deployContract, deployProxyContract } from 'utils/deployment.utils';

export const deployRIFGateway = async (registerInterfaceId = true) => {
  const { contract: serviceTypeManager } =
    await deployContract<ServiceTypeManager>('ServiceTypeManager', {});

  const { contract: gatewayAccessControl } =
    await deployContract<IGatewayAccessControl>('GatewayAccessControl', {});

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

  const iface = new ethers.utils.Interface([
    'function initialize(address serviceTypeManagerAddr,address gatewayAccessControlAddr, address feeManagerAddr)',
  ]);
  const msgData = iface.encodeFunctionData('initialize', [
    serviceTypeManager.address,
    gatewayAccessControl.address,
  ]);

  const { contract: rifGateway } = await deployProxyContract<
    RIFGateway,
    IRIFGateway
  >('RIFGateway', 'RIFGatewayLogicV1', msgData);

  return { RIFGateway: rifGateway, feeManager, serviceTypeManager };
};

export function toSmallNumber(bn: BigNumber, divisor = 1e18) {
  return +bn / divisor;
}
