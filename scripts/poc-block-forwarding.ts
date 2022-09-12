import { network } from 'hardhat';

async function main() {
  //time manipulation...
  // Fast forward 100 blocks
  await network.provider.send('hardhat_mine', ['0x' + (100).toString(16)]);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
