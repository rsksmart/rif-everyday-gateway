import ethers, { Signer, providers, BigNumberish, BigNumber } from 'ethers';
import * as genTypes from '../../typechain-types';

export type MTAccount = {
  signer: Signer;
  provider: providers.Web3Provider;
};

export type MTData = {
  executor: string;
  chainId: string;
  factoryAddress: string;
};

export type SmartWalletInfo = {
  address: string;
  nonce: BigNumber;
};

export type PromiseOrValue<T> = T | Promise<T>;

export type ForwardRequestStruct = {
  from: PromiseOrValue<string>;
  nonce: PromiseOrValue<BigNumberish>;
  executor: PromiseOrValue<string>;
};

export type EIP712Payload = {
  types: {
    ForwardRequest: Array<{ name: string; type: string }>;
  };
  domain: {
    name: string;
    version: string;
    chainId: string;
    verifyingContract: string;
  };
  primaryType: string;
  message: {
    from: string;
    nonce: string;
    executor: string;
  };
};

class DeFiGatewaySigner {
  static async sign(
    account: MTAccount,
    data: MTData
  ): Promise<ForwardRequestStruct> {
    const from = await account.signer.getAddress();
    const smartWallet = await this.getSmartWalletInfo(
      account,
      from,
      data.factoryAddress
    );
    const payload = this.buildPayload(
      data.chainId,
      from,
      data.executor,
      smartWallet
    );

    // eslint-disable-next-line prefer-const
    let forwardRequest = {};

    // REPLACE WITH APPROPIATE SIGNATURE FUNCTION
    // For ethers.js on the browser use:
    // forwardRequest = await signer._signTypedData(
    //   payload.domain,
    //   payload.types,
    //   payload.message
    // );

    return forwardRequest as ForwardRequestStruct;
  }

  private static async getSmartWalletInfo(
    account: MTAccount,
    owner: string,
    factoryAddress: string
  ): Promise<SmartWalletInfo> {
    const factory = new ethers.Contract(
      factoryAddress,
      genTypes.SmartWalletFactory__factory.abi,
      account.provider
    ) as genTypes.SmartWalletFactory;

    const smartWalletAddress = await factory.getSmartWalletAddress(owner);
    const isDeployed =
      (await account.provider.getCode(smartWalletAddress)) !== '0x';

    let nonce = ethers.constants.Zero;

    if (isDeployed) {
      const smartwallet = new ethers.Contract(
        smartWalletAddress,
        genTypes.SmartWallet__factory.abi,
        account.provider
      ) as genTypes.SmartWallet;

      nonce = await smartwallet.nonce();
    }

    return {
      address: smartWalletAddress,
      nonce,
    };
  }

  private static buildPayload(
    chainId: string,
    from: string,
    executor: string,
    smartwallet: SmartWalletInfo
  ): EIP712Payload {
    return {
      types: {
        // TODO: Clarify if EIP712Domain refers to the domain the contract is hosted on
        ForwardRequest: [
          { name: 'from', type: 'address' },
          { name: 'nonce', type: 'uint256' },
          { name: 'executor', type: 'address' },
        ],
      },
      domain: {
        // Give a user friendly name to the specific contract you are signing for.
        name: 'RSK RIF GATEWAY',
        // Just let's you know the latest version. Definitely make sure the field name is correct.
        version: '1',
        // Defining the chain aka Rinkeby testnet or Ethereum Main Net
        chainId: chainId,
        // If name isn't enough add verifying contract to make sure you are establishing contracts with the proper entity
        verifyingContract: smartwallet.address,
      },
      // Refers to the keys of the *types* object below.
      primaryType: 'ForwardRequest',
      // Defining the message signing data content.
      message: {
        from: from,
        nonce: smartwallet.nonce.toString(),
        executor: executor,
      },
    };
  }
}
