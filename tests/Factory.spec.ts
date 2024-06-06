import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Address, toNano, beginCell } from '@ton/core';
import { SampleJetton } from '../wrappers/SampleJetton';
// import { JettonDefaultWallet as JettonWallet } from '../wrappers/Jetton';
import { JettonDefaultWallet as JettonWallet } from '../build/SampleJetton/tact_JettonDefaultWallet';
import '@ton/test-utils';
import { send } from 'process';
import { buildOnchainMetadata } from "../utils/jetton-helpers";
import { factory as Factory } from '../build/Factory/tact_factory';
const jettonParams = {
    name: "Live2",
    description: "This is the first jetton from live2",
    symbol: "Li2",
    image: "https://avatars.githubusercontent.com/u/115602512?s=96&v=4",
};

describe('Factory', () => {
    // 保存原始的console.log函数
    const originalLog = console.log;

    // 自定义一个新的console.log函数
    console.log = (...args) => {
        process.stdout.write(args.join(' ') + '\n');
    };

    // 在你的测试结束后，恢复原始的console.log函数
    afterAll(() => {
        console.log = originalLog;
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let factory: SandboxContract<Factory>;
    let sampleJetton: SandboxContract<SampleJetton>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        factory = blockchain.openContract(await Factory.fromInit(deployer.address));

        // Create content Cell
        let content = buildOnchainMetadata(jettonParams);
        let max_supply = toNano(123456766689011);

        sampleJetton = blockchain.openContract(await SampleJetton.fromInit(deployer.address, content, max_supply));

        const jettonDeployResult = await sampleJetton.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'Deploy',
                queryId: 0n,
            }
        );

        expect(jettonDeployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: sampleJetton.address,
            deploy: true,
            success: true,
        });

        // Deploy Factory
        const factoryResult = await factory.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'Deploy',
                queryId: 0n,
            }
        );

        expect(factoryResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: factory.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        
    });

    it('should create pair', async () => {
        const CreatePairResult = await factory.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'CreatePair',
                jetton: sampleJetton.address,
                owner: deployer.address,
            }
        );

        expect(CreatePairResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: factory.address,
            success: true,
        });
    });
});