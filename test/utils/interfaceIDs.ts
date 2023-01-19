import { ethers } from 'ethers';

export const BORROW_SERVICE_INTERFACEID = '0xf977581c';
export const LENDING_SERVICE_INTERFACEID = '0xcc2ee280';

export function getFirstOrderInterfaceID(
  contractInterface: ethers.utils.Interface
) {
  let interfaceID: ethers.BigNumber = ethers.constants.Zero;
  const functions: string[] = Object.keys(contractInterface.functions);
  for (let i = 0; i < functions.length; i++) {
    interfaceID = interfaceID.xor(contractInterface.getSighash(functions[i]));
  }

  return interfaceID;
}

export function getInterfaceID(interfaces: ethers.utils.Interface[]) {
  let interfaceID: ethers.BigNumber = ethers.constants.Zero;
  for (const iface of interfaces) {
    interfaceID = interfaceID.xor(getFirstOrderInterfaceID(iface));
  }

  return interfaceID;
}
