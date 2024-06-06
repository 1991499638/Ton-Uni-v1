import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano, beginCell, fromNano } from '@ton/core';
import { main } from '../wrappers/Exchange';
import { SampleJetton } from '../wrappers/SampleJetton';
import { JettonDefaultWallet as JettonWallet } from '../build/SampleJetton/tact_JettonDefaultWallet';
import { JettonDefaultWallet as Wallet } from '../build/SampleJetton/tact_JettonDefaultWallet';
import { JettonDefaultWallet as LPJettonWallet } from '../build/Exchange/tact_JettonDefaultWallet';
import '@ton/test-utils';
import { send } from 'process';
import { buildOnchainMetadata } from "../utils/jetton-helpers";
import { randomInt } from 'crypto';
import exp from 'constants';

const jettonParams = {
    name: "Live2",
    description: "This is the first jetton from live2",
    symbol: "Li2",
    image: "https://avatars.githubusercontent.com/u/115602512?s=96&v=4",
};

describe('main', () => {
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
    let exchange: SandboxContract<main>;
    let sampleJetton: SandboxContract<SampleJetton>;
    let jettonDefaultWallet: SandboxContract<JettonWallet>;
    let wallet: SandboxContract<Wallet>;
    let lpJettonDefaultWallet: SandboxContract<LPJettonWallet>;
    let user: SandboxContract<TreasuryContract>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        user = await blockchain.treasury('user');

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

        /// Create Exchange
        exchange = blockchain.openContract(await main.fromInit(sampleJetton.address , deployer.address));

        const deployResult = await exchange.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'Deploy',
                queryId: 0n,
            }
        );

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: exchange.address,
            deploy: true,
            success: true,
        });

        /////////////////////////////
        const amount = toNano('1234');
        const mintResult = await sampleJetton.send(
            deployer.getSender(),
            {
                value: amount,
            },
            {
                $$type: 'Mint',
                amount: amount,
                receiver: deployer.address,
            }
        );

        expect(mintResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: sampleJetton.address,
            value: amount,
            success: true,
        });

        jettonDefaultWallet = blockchain.openContract(await JettonWallet.fromInit(sampleJetton.address, exchange.address));
        const SetMyJettonWallet = await exchange.send(
            deployer.getSender(),
            {
                value: toNano('0.5'),
            },
            {
                $$type: 'SetMyJettonWallet',
                wallet: jettonDefaultWallet.address,
            }
        );
        expect(SetMyJettonWallet.transactions).toHaveTransaction({
            from: deployer.address,
            to: exchange.address,
            success: true,
        });

        jettonDefaultWallet = blockchain.openContract(await JettonWallet.fromInit(sampleJetton.address, deployer.address));
        let balance = await jettonDefaultWallet.getGetWalletData();
        console.log("balance", fromNano(balance.balance));    
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and exchange are ready to use
        
    });

    function cell(pram: string) {
        return beginCell().storeBit(1).storeUint(0, 32).storeStringTail(pram).endCell();
    }

    it("should add liqudity", async () => {
        console.log("\n--------------before-------------");
        jettonDefaultWallet = blockchain.openContract(await JettonWallet.fromInit(sampleJetton.address, deployer.address));
        let balance = await jettonDefaultWallet.getGetWalletData();
        console.log("before exchange jetton balance: ", fromNano(balance.balance));    
        let before_getJettonReserve = await exchange.getGetJettonReserve();
        console.log("before exchange jetton reserve: ", fromNano(before_getJettonReserve));

        let ton = toNano(7);
        let amount = toNano(7);
        const addLiqudityResult = await jettonDefaultWallet.send(
            deployer.getSender(),
            {
                value: toNano('10'),
            },
            {
                $$type: "TokenTransfer",
                queryId: 1n,
                amount: amount,
                destination: exchange.address,
                response_destination: deployer.address,
                custom_payload: cell("Mint"),
                forward_ton_amount: ton,
                forward_payload: cell("addLiqudity"),
            }
        );
        expect(addLiqudityResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: jettonDefaultWallet.address,
            success: true,
        });

        console.log("\n--------------after-------------");
        jettonDefaultWallet = blockchain.openContract(await JettonWallet.fromInit(sampleJetton.address, exchange.address));
        balance = await jettonDefaultWallet.getGetWalletData();
        console.log("after exchange jetton balance: ", fromNano(balance.balance));  

        let getJettonReserve = await exchange.getGetJettonReserve();
        let getMyBalance = await exchange.getGetMyBalance();
        let lpBalance = await exchange.getGetBalance(deployer.address);
        let lpReserve = await exchange.getGetTotalSupply();
        console.log(`
        getJettonReserve:  ${fromNano(getJettonReserve)}
        getMyBalance:  ${fromNano(getMyBalance)}
        LP Token-0:  ${fromNano(lpBalance)}
        LP Reserve:  ${fromNano(lpReserve)}`);
        expect(getJettonReserve).toEqual(before_getJettonReserve + amount);
        // expect(lpBalance).toEqual(ton);
        expect(lpReserve).toEqual(lpBalance);

        let n = 20;
        for (let i = 0; i < n; i++) {
            console.log(`\n--------------before round ${i+1}-------------`);
            jettonDefaultWallet = blockchain.openContract(await JettonWallet.fromInit(sampleJetton.address, deployer.address));
            let balance = await jettonDefaultWallet.getGetWalletData();
            console.log("before exchange jetton balance: ", fromNano(balance.balance));    
            let before_getJettonReserve = await exchange.getGetJettonReserve();
            console.log("before exchange jetton reserve: ", fromNano(before_getJettonReserve));

            let ton = toNano(7);
            let amount = toNano(7);
            const addLiqudityResult = await jettonDefaultWallet.send(
                deployer.getSender(),
                {
                    value: toNano('10'),
                },
                {
                    $$type: "TokenTransfer",
                    queryId: 1n,
                    amount: amount,
                    destination: exchange.address,
                    response_destination: deployer.address,
                    custom_payload: cell("Mint"),
                    forward_ton_amount: ton,
                    forward_payload: cell("addLiqudity"),
                }
            );
            expect(addLiqudityResult.transactions).toHaveTransaction({
                from: deployer.address,
                to: jettonDefaultWallet.address,
                success: true,
            });

            console.log(`\n--------------after round ${i+1}-------------`);
            jettonDefaultWallet = blockchain.openContract(await JettonWallet.fromInit(sampleJetton.address, exchange.address));
            balance = await jettonDefaultWallet.getGetWalletData();
            console.log("after exchange jetton balance: ", balance.balance);  

            let getJettonReserve = await exchange.getGetJettonReserve();
            let getMyBalance = await exchange.getGetMyBalance();
            let lpBalance = await exchange.getGetBalance(deployer.address);
            let lpReserve = await exchange.getGetTotalSupply();
            console.log(`
            getJettonReserve ${i+1}:  ${fromNano(getJettonReserve)}
            getMyBalance ${i+1}:  ${fromNano(getMyBalance)}
            LP Token-0 ${i+1}:  ${fromNano(lpBalance)}
            LP Reserve ${i+1}:  ${fromNano(lpReserve)}`);
            expect(getJettonReserve).toEqual(before_getJettonReserve + amount);
            // expect(lpBalance).toEqual(ton);

            expect(lpReserve).toEqual(lpBalance);

        }
    });

    // it("should reverse a notify message", async() => { 
    //     let tonAmount = 2;
    //     let jettonAmount = 2;
    //     console.log("--------------before-------------")
    //     let before_getJettonReserve = await exchange.getGetJettonReserve();
    //     let before_getMyBalance = await exchange.getGetMyBalance();
    //     let before_TotalSupply = await exchange.getGetBalance(deployer.address);
    //     let before_lpReserve = await exchange.getGetTotalSupply();
    //     console.log(`getJettonReserve ${before_getJettonReserve}\ngetMyBalance ${before_getMyBalance}\nLP Token-0 ${before_TotalSupply}\nLP Reserve ${before_lpReserve}`);

    //     const addLiqudityResult = await exchange.send(
    //         deployer.getSender(),
    //         {
    //             value: toNano(tonAmount),
    //         },
    //         {
    //             $$type: "TokenNotification",
    //             queryId: 1n,
    //             amount: toNano(jettonAmount),
    //             from: deployer.address,
    //             forward_payload: cell("addLiqudity"),
    //         }
    //     );
    //     console.log("--------------after-------------")
    //     let after_getJettonReserve = await exchange.getGetJettonReserve();
    //     let after_getMyBalance = await exchange.getGetMyBalance();
    //     let after_TotalSupply = await exchange.getGetBalance(deployer.address);
    //     let after_lpReserve = await exchange.getGetTotalSupply();
    //     console.log(`getJettonReserve ${after_getJettonReserve}\ngetMyBalance ${after_getMyBalance}\nLP Token-0 ${after_TotalSupply}\nLP Reserve ${after_lpReserve}`);

    //     expect(addLiqudityResult.transactions).toHaveTransaction({
    //         from: deployer.address,
    //         to: exchange.address,
    //         success: true,
    //     });

    //     expect(after_getJettonReserve).toEqual(before_getJettonReserve + toNano(jettonAmount));
    //     expect(after_TotalSupply).toEqual(before_TotalSupply + toNano(tonAmount));
    //     expect(after_lpReserve).toEqual(before_lpReserve + after_TotalSupply);

    //     let n = 4;
    //     for (let i = 0; i < n; i++) {
    //         tonAmount = 7;
    //         jettonAmount = 2;
    //         console.log(`--------------before ${i+1}-------------`)
    //         let before_getJettonReserve = await exchange.getGetJettonReserve();
    //         let before_getMyBalance = await exchange.getGetMyBalance();
    //         let before_TotalSupply = await exchange.getGetBalance(deployer.address);
    //         let before_lpReserve = await exchange.getGetTotalSupply();
    //         console.log(`getJettonReserve ${before_getJettonReserve}\ngetMyBalance ${before_getMyBalance}\nLP Token-0 ${before_TotalSupply}\nLP Reserve ${before_lpReserve}`);
    
    //         const addLiqudityResult = await exchange.send(
    //             deployer.getSender(),
    //             {
    //                 value: toNano(i) + toNano(tonAmount),
    //             },
    //             {
    //                 $$type: "TokenNotification",
    //                 queryId: BigInt(i) + 1n,
    //                 amount: toNano(i) + toNano(jettonAmount),
    //                 from: deployer.address,
    //                 forward_payload: cell("addLiqudity"),
    //             }
    //         );
    //         console.log(`--------------after ${i+1}-------------`)
    //         let after_getJettonReserve = await exchange.getGetJettonReserve();
    //         let after_getMyBalance = await exchange.getGetMyBalance();
    //         let after_TotalSupply = await exchange.getGetBalance(deployer.address);
    //         let after_lpReserve = await exchange.getGetTotalSupply();
    //         console.log(`getJettonReserve ${after_getJettonReserve}\ngetMyBalance ${after_getMyBalance}\nLP Token-0 ${after_TotalSupply}\nLP Reserve ${after_lpReserve}`);
    
    //         expect(addLiqudityResult.transactions).toHaveTransaction({
    //             from: deployer.address,
    //             to: exchange.address,
    //             success: true,
    //         });
    
    //         expect(after_getJettonReserve).toEqual(before_getJettonReserve + toNano(i) + toNano(jettonAmount));
    //         let LPAmount = (toNano(i) + toNano(jettonAmount));
    //         expect(after_TotalSupply).toEqual(before_TotalSupply + LPAmount);
    //         // expect(after_lpReserve).toEqual(before_lpReserve + after_TotalSupply);
    //     }
        
    // });

    it("should remove liqudity", async () => {
        // add liqudity to exchange
        jettonDefaultWallet = blockchain.openContract(await JettonWallet.fromInit(sampleJetton.address, deployer.address));
        let ton = toNano(700);
        let amount = toNano(700);
        const addLiqudityResult = await jettonDefaultWallet.send(
            deployer.getSender(),
            {
                value: toNano('1000'),
            },
            {
                $$type: "TokenTransfer",
                queryId: 1n,
                amount: amount,
                destination: exchange.address,
                response_destination: deployer.address,
                custom_payload: cell("Mint"),
                forward_ton_amount: ton,
                forward_payload: cell("addLiqudity"),
            }
        );
        expect(addLiqudityResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: jettonDefaultWallet.address,
            success: true,
        });
        jettonDefaultWallet = blockchain.openContract(await JettonWallet.fromInit(sampleJetton.address, exchange.address));
        let before_balance = await jettonDefaultWallet.getGetWalletData();
        console.log("\nbefore exchange jetton balance: ", fromNano(before_balance.balance));  
        let before_getJettonReserve = await exchange.getGetJettonReserve();
        console.log("before exchange jetton reserve: ", fromNano(before_getJettonReserve));
        lpJettonDefaultWallet = blockchain.openContract(await LPJettonWallet.fromInit(exchange.address, deployer.address));
        let lpBalance = await lpJettonDefaultWallet.getGetWalletData();
        console.log("LP balance: ", fromNano(lpBalance.balance));
        let before_lpBalance = await exchange.getGetBalance(deployer.address);
        console.log("LP balance1: ", fromNano(before_lpBalance));

        // remove liqudity
        jettonDefaultWallet = blockchain.openContract(await JettonWallet.fromInit(sampleJetton.address, deployer.address));
        let before_deployerJettonData = await jettonDefaultWallet.getGetWalletData();
        console.log("deployerJettonBalance", fromNano(before_deployerJettonData.balance));

        jettonDefaultWallet = blockchain.openContract(await JettonWallet.fromInit(sampleJetton.address, exchange.address));
        lpJettonDefaultWallet = blockchain.openContract(await LPJettonWallet.fromInit(exchange.address, deployer.address));
        amount = toNano(7);
        let RemoveLiqudity = await lpJettonDefaultWallet.send(
            deployer.getSender(),
            {
                value: toNano('10'),
            },
            {
                $$type: "TokenTransfer",
                queryId: 1n,
                amount: amount,
                destination: exchange.address,
                response_destination: deployer.address,
                custom_payload: cell("Mint"),
                forward_ton_amount: toNano("0.5"),
                forward_payload: cell("removeLiqudity"),
            }
        );
        expect(RemoveLiqudity.transactions).toHaveTransaction({
            from: deployer.address,
            to: lpJettonDefaultWallet.address,
            success: true,
        });

        let after_balance = await jettonDefaultWallet.getGetWalletData();
        console.log("\nafter exchange jetton balance: ", fromNano(after_balance.balance));
        let after_getJettonReserve = await exchange.getGetJettonReserve();
        console.log("after exchange jetton reserve: ", fromNano(after_getJettonReserve));
        let after_lpBalance = await lpJettonDefaultWallet.getGetWalletData();
        console.log("after LP balance: ", fromNano(after_lpBalance.balance));
        let after_lpBalance1 = await exchange.getGetBalance(deployer.address);
        console.log("after LP balance1: ", fromNano(after_lpBalance1));

        jettonDefaultWallet = blockchain.openContract(await JettonWallet.fromInit(sampleJetton.address, deployer.address));
        let after_deployerJettonData = await jettonDefaultWallet.getGetWalletData();
        console.log("after deployerJettonBalance", fromNano(after_deployerJettonData.balance));



    })

    // it("should transfer by contract", async () => {
    //     // add liqudity to exchange
    //     jettonDefaultWallet = blockchain.openContract(await JettonWallet.fromInit(sampleJetton.address, deployer.address));
    //     let ton = toNano(700);
    //     let amount = toNano(700);
    //     const addLiqudityResult = await jettonDefaultWallet.send(
    //         deployer.getSender(),
    //         {
    //             value: toNano('1000'),
    //         },
    //         {
    //             $$type: "TokenTransfer",
    //             queryId: 1n,
    //             amount: amount,
    //             destination: exchange.address,
    //             response_destination: deployer.address,
    //             custom_payload: cell("Mint"),
    //             forward_ton_amount: ton,
    //             forward_payload: cell("addLiqudity"),
    //         }
    //     );
    //     expect(addLiqudityResult.transactions).toHaveTransaction({
    //         from: deployer.address,
    //         to: jettonDefaultWallet.address,
    //         success: true,
    //     });
    //     jettonDefaultWallet = blockchain.openContract(await JettonWallet.fromInit(sampleJetton.address, exchange.address));
    //     let balance = await jettonDefaultWallet.getGetWalletData();
    //     console.log("before exchange jetton balance: ", fromNano(balance.balance));  
    //     let getJettonReserve = await exchange.getGetJettonReserve();
    //     console.log("before exchange jetton reserve: ", fromNano(getJettonReserve));

    //     // exchange send 10 jetton to user
    //     let Address = jettonDefaultWallet.address;
    //     let InitOf = await JettonWallet.init(sampleJetton.address, exchange.address);
    //     const transferJettonToUser = await exchange.send(
    //         deployer.getSender(),
    //         {
    //             value: toNano('10'),
    //         },
    //         {
    //             $$type: 'SendJetton',
    //             to: Address,
    //             amount: toNano('10'),
    //             value: toNano('10'),
    //         }
    //     );

    //     balance = await jettonDefaultWallet.getGetWalletData();
    //     console.log("after: exchange Jetton balance", fromNano(balance.balance));  
    //     getJettonReserve = await exchange.getGetJettonReserve();
    //     console.log("after exchange jetton reserve: ", fromNano(getJettonReserve));
    //     // let wallte = await exchange.getGetWallte(sampleJetton.address, exchange.address);
    //     // console.log("Tact exchange Wallet: ", wallte);
    //     // console.log("jettonDefaultWallet init: ", jettonDefaultWallet.init);

    //     // jettonDefaultWallet = blockchain.openContract(await JettonWallet.fromInit(sampleJetton.address, deployer.address));
    //     // balance = await jettonDefaultWallet.getGetWalletData();
    //     // console.log("user balance", balance.balance);   

    //     expect(transferJettonToUser.transactions).toHaveTransaction({
    //         from: deployer.address,
    //         to: exchange.address,
    //         success: true,
    //     });
    // })

    it("should Jetton swap ton", async () => {
        // add liqudity to exchange
        jettonDefaultWallet = blockchain.openContract(await JettonWallet.fromInit(sampleJetton.address, deployer.address));
        let ton = toNano(700);
        let amount = toNano(700);
        const addLiqudityResult = await jettonDefaultWallet.send(
            deployer.getSender(),
            {
                value: toNano('1000'),
            },
            {
                $$type: "TokenTransfer",
                queryId: 1n,
                amount: amount,
                destination: exchange.address,
                response_destination: deployer.address,
                custom_payload: cell("Mint"),
                forward_ton_amount: ton,
                forward_payload: cell("addLiqudity"),
            }
        );
        expect(addLiqudityResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: jettonDefaultWallet.address,
            success: true,
        });
        jettonDefaultWallet = blockchain.openContract(await JettonWallet.fromInit(sampleJetton.address, exchange.address));
        let before_balance = await jettonDefaultWallet.getGetWalletData();
        console.log("before exchange jetton balance: ", fromNano(before_balance.balance));  
        let before_getJettonReserve = await exchange.getGetJettonReserve();
        console.log("before exchange jetton reserve: ", fromNano(before_getJettonReserve));
        let before_getMyBalance = await exchange.getGetMyBalance();
        console.log("before exchange ton balance: ", fromNano(before_getMyBalance));

        // jetton swap ton
        let jettonAmount = toNano(10);
        jettonDefaultWallet = blockchain.openContract(await JettonWallet.fromInit(sampleJetton.address, deployer.address));
        const jettonSwapTon = await jettonDefaultWallet.send(
            deployer.getSender(),
            {
                value: toNano('1'),
            },
            {
                $$type: "TokenTransfer",
                queryId: 1n,
                amount: jettonAmount,
                destination: exchange.address,
                response_destination: deployer.address,
                custom_payload: cell("Mint"),
                forward_ton_amount: toNano("0.5"),
                forward_payload: cell("JettonToSwapTon"),
            }
        );
        expect(jettonSwapTon.transactions).toHaveTransaction({
            from: deployer.address,
            to: jettonDefaultWallet.address,
            success: true,
        });

        let tonReverse = await exchange.getGetMyBalance() - toNano(1);
        let jettonReverse = await exchange.getGetJettonReserve() - jettonAmount;
        let ExpectCalculateTon = await exchange.getCalculate(jettonAmount, jettonReverse, tonReverse);
        console.log("ExpectCalculateTon", fromNano(ExpectCalculateTon));
        
        jettonDefaultWallet = blockchain.openContract(await JettonWallet.fromInit(sampleJetton.address, exchange.address));
        let after_balance = await jettonDefaultWallet.getGetWalletData();
        console.log("after exchange jetton balance: ", fromNano(after_balance.balance));
        let after_getJettonReserve = await exchange.getGetJettonReserve();
        console.log("after exchange jetton reserve: ", fromNano(after_getJettonReserve));
        let after_getMyBalance = await exchange.getGetMyBalance();
        console.log("after exchange ton balance: ", fromNano(after_getMyBalance));
        let ActualTonAmount = before_getMyBalance - after_getMyBalance;
        console.log("ActualTonAmount", fromNano(ActualTonAmount));
        let diff = ActualTonAmount - ExpectCalculateTon;
        expect(Math.abs(Number(fromNano(diff)))).toBeLessThan(1);

        // ----------------- test round -----------------
        let n = 20;
        for (let i = 0; i < n; i++) {
            jettonDefaultWallet = blockchain.openContract(await JettonWallet.fromInit(sampleJetton.address, deployer.address));
            let balance = await jettonDefaultWallet.getGetWalletData();
            // console.log("before exchange jetton balance: ", fromNano(balance.balance));    
            let before_getJettonReserve = await exchange.getGetJettonReserve();
            // console.log("before exchange jetton reserve: ", fromNano(before_getJettonReserve));
            let before_getMyBalance = await exchange.getGetMyBalance();
            // console.log("before exchange ton balance: ", fromNano(before_getMyBalance));

            let jettonAmount = toNano(Math.floor(Math.random() * 10) + 1);
            jettonDefaultWallet = blockchain.openContract(await JettonWallet.fromInit(sampleJetton.address, deployer.address));
            const jettonSwapTon = await jettonDefaultWallet.send(
                deployer.getSender(),
                {
                    value: toNano('1'),
                },
                {
                    $$type: "TokenTransfer",
                    queryId: BigInt(i) + 1n,
                    amount: jettonAmount,
                    destination: exchange.address,
                    response_destination: deployer.address,
                    custom_payload: cell("Mint"),
                    forward_ton_amount: toNano("0.5"),
                    forward_payload: cell("JettonToSwapTon"),
                }
            );
            expect(jettonSwapTon.transactions).toHaveTransaction({
                from: deployer.address,
                to: jettonDefaultWallet.address,
                success: true,
            });

            let tonReverse = await exchange.getGetMyBalance() - toNano(1);
            let jettonReverse = await exchange.getGetJettonReserve() - jettonAmount;
            let ExpectCalculateTon = await exchange.getCalculate(jettonAmount, jettonReverse, tonReverse);
            // console.log("ExpectCalculateTon", fromNano(ExpectCalculateTon));
            
            jettonDefaultWallet = blockchain.openContract(await JettonWallet.fromInit(sampleJetton.address, exchange.address));
            let after_balance = await jettonDefaultWallet.getGetWalletData();
            // console.log("after exchange jetton balance: ", fromNano(after_balance.balance));
            let after_getJettonReserve = await exchange.getGetJettonReserve();
            // console.log("after exchange jetton reserve: ", fromNano(after_getJettonReserve));
            let after_getMyBalance =  await exchange.getGetMyBalance();
            // console.log("after exchange ton balance: ", fromNano(after_getMyBalance));
            let ActualTonAmount = before_getMyBalance - after_getMyBalance;
            // console.log("ActualTonAmount", fromNano(ActualTonAmount));
            let diff = ActualTonAmount - ExpectCalculateTon;
            expect(Math.abs(Number(fromNano(diff)))).toBeLessThan(1);
            
        }


    })

    it("should ton swap Jetton", async () => {
        // add liqudity to exchange
        jettonDefaultWallet = blockchain.openContract(await JettonWallet.fromInit(sampleJetton.address, deployer.address));
        let ton = toNano(700);
        let amount = toNano(700);
        const addLiqudityResult = await jettonDefaultWallet.send(
            deployer.getSender(),
            {
                value: toNano('1000'),
            },
            {
                $$type: "TokenTransfer",
                queryId: 1n,
                amount: amount,
                destination: exchange.address,
                response_destination: deployer.address,
                custom_payload: cell("Mint"),
                forward_ton_amount: ton,
                forward_payload: cell("addLiqudity"),
            }
        );
        expect(addLiqudityResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: jettonDefaultWallet.address,
            success: true,
        });
        jettonDefaultWallet = blockchain.openContract(await JettonWallet.fromInit(sampleJetton.address, exchange.address));
        let before_balance = await jettonDefaultWallet.getGetWalletData();
        console.log("before exchange jetton balance: ", fromNano(before_balance.balance));  
        let before_getJettonReserve = await exchange.getGetJettonReserve();
        console.log("before exchange jetton reserve: ", fromNano(before_getJettonReserve));

        // ton swap jetton
        let sender = deployer.address;
        let jettonAmount = toNano(10);
        let tonAmount = toNano(10);
        let toWallet = jettonDefaultWallet.address;
        const toswapjetton = await exchange.send(
            deployer.getSender(),
            {
                value: tonAmount,
            },
            {
                $$type: 'TonToSwapJetton',
                sender: sender,
                queryId: 1n,
            }
        );
        expect(toswapjetton.transactions).toHaveTransaction({
            from: deployer.address,
            to: exchange.address,
            success: true,
        });

        let tonReverse = await exchange.getGetMyBalance() - tonAmount;
        let jettonReverse = await exchange.getGetJettonReserve();
        let ExpectCalculateJetton = await exchange.getCalculate(tonAmount, tonReverse, jettonReverse);
        console.log("ExpectCalculateJetton", fromNano(ExpectCalculateJetton));


        let after_balance = await jettonDefaultWallet.getGetWalletData();
        console.log("after exchange jetton balance: ", fromNano(after_balance.balance));  
        let after_getJettonReserve = await exchange.getGetJettonReserve();
        console.log("after exchange jetton reserve: ", fromNano(after_getJettonReserve));
        let ActualJettonAmount = before_getJettonReserve - after_getJettonReserve;
        console.log("ActualJettonAmount", fromNano(ActualJettonAmount));
    })

    // test sampleJetton address
    it.skip("test Address", async () => {
        
        // -------------------------
        // TS wallte
        // -------------------------
        let master = sampleJetton.address;
        master = exchange.address;
        let owner = deployer.address;
        // owner = exchange.address;
        jettonDefaultWallet = blockchain.openContract(await JettonWallet.fromInit(master, owner));
        wallet = blockchain.openContract(await Wallet.fromInit(master, owner));
        lpJettonDefaultWallet = blockchain.openContract(await LPJettonWallet.fromInit(master, owner));
        let Address = jettonDefaultWallet.address;
        console.log("Address", Address);
        let Address1 = wallet.address;
        console.log("Address1", Address1);
        let Address2 = lpJettonDefaultWallet.address;
        console.log("Address2", Address2);

        // -------------------------
        // Tact wallte
        // -------------------------
        let jettonWallet = await sampleJetton.getGetWalletAddress(owner);
        console.log("\njettonWallet", jettonWallet);
        let lpWallet = await exchange.getGetWalletAddress(owner);
        console.log("lpWallet", lpWallet);

        // -------------------------
        // Tact calculate wallte
        // -------------------------
        let calculateWallet = await exchange.getGetWallte(master, owner);
        console.log("\ncalculateWallet", calculateWallet);


    })
});
