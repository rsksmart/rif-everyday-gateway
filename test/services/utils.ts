import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import {
  BORROW_SERVICE_INTERFACEID,
  LENDING_SERVICE_INTERFACEID,
} from 'test/utils/interfaceIDs';
import {
  RIFGateway,
  ServiceTypeManager,
  GatewayAccessControl,
  FeeManager,
} from 'typechain-types';
import { deployContract } from 'utils/deployment.utils';

export const deployRIFGateway = async (registerInterfaceId = true) => {
  const { contract: serviceTypeManager } =
    await deployContract<ServiceTypeManager>('ServiceTypeManager', {});

  const { contract: gatewayAccessControl } =
    await deployContract<GatewayAccessControl>('GatewayAccessControl', {});

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

  const { contract: RIFGateway } = await deployContract<RIFGateway>(
    'RIFGateway',
    {
      ServiceTypeManager: serviceTypeManager.address,
      GatewayAccessControl: gatewayAccessControl.address,
    }
  );

  const feeManager = await ethers.getContractAt(
    'FeeManager',
    await RIFGateway.feeManager()
  );

  return { RIFGateway, feeManager, serviceTypeManager, gatewayAccessControl };
};

export function toSmallNumber(bn: BigNumber, divisor = 1e18) {
  return +bn / divisor;
}
