import { ethers } from 'hardhat';
import {
  BORROW_SERVICE_INTERFACEID,
  LENDING_SERVICE_INTERFACEID,
} from 'test/utils/interfaceIDs';
import { IFeeManager, RIFGateway, ServiceTypeManager } from 'typechain-types';
import { deployContract } from 'utils/deployment.utils';

export const deployRIFGateway = async (registerInterfaceId = true) => {
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

  const { contract: RIFGateway } = await deployContract<RIFGateway>(
    'RIFGateway',
    {
      ServiceTypeManager: serviceTypeManager.address,
    }
  );

  const feeManager = await ethers.getContractAt(
    'IFeeManager',
    await RIFGateway.feeManager()
  );

  return { RIFGateway, feeManager, serviceTypeManager };
};
