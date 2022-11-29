import { IFeeManager, IRIFGateway, ServiceTypeManager } from 'typechain-types';
import { deployContract } from 'utils/deployment.utils';

export const deployRIFGateway = async (registerInterfaceId = true) => {
  const { contract: serviceTypeManager } =
    await deployContract<ServiceTypeManager>('ServiceTypeManager', {});

  if (registerInterfaceId) {
    // allow lending service interface id
    const LENDING_SERVICE_INTERFACEID = '0xd9eedeca';
    const tLx = await serviceTypeManager.addServiceType(
      LENDING_SERVICE_INTERFACEID
    );
    tLx.wait();

    // allow borrowing service interface id
    const BORROW_SERVICE_INTERFACEID = '0x7337eabd';
    const tBx = await serviceTypeManager.addServiceType(
      BORROW_SERVICE_INTERFACEID
    );
    tBx.wait();
  }

  const { contract: feeManager } = await deployContract<IFeeManager>(
    'FeeManager',
    {}
  );
  const { contract: RIFGateway } = await deployContract<IRIFGateway>(
    'RIFGateway',
    {
      ServiceTypeManager: serviceTypeManager.address,
      FeeManager: feeManager.address,
    }
  );

  return { RIFGateway, feeManager, serviceTypeManager };
};
