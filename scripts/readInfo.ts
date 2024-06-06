import { toNano, Address, fromNano } from '@ton/core';
import { main } from '../wrappers/Exchange';
import { JettonDefaultWallet as JettonWallet } from '../build/SampleJetton/tact_JettonDefaultWallet';
import { JettonDefaultWallet as LPWallet } from '../build/Exchange/tact_JettonDefaultWallet';
import { NetworkProvider } from '@ton/blueprint';
import { buildOnchainMetadata } from "../utils/jetton-helpers";
import fs from 'fs';

export async function run(provider: NetworkProvider) {
    let rawdata = fs.readFileSync('JettonAddress.json');
    const jettonAddress = Address.parse(JSON.parse(rawdata.toString()));
    const user = provider.sender().address as Address;
    
    const exchange = provider.open(await main.fromInit(jettonAddress, user));
    const user_jetton_wallet = provider.open(await JettonWallet.fromInit(jettonAddress, user));
    const exchange_jetton_wallet = provider.open(await JettonWallet.fromInit(jettonAddress, exchange.address));

    let TonBalance = await exchange.getGetBalance(user);
    console.log('exchange_Ton_Balance', fromNano(TonBalance));

    let walletData = await user_jetton_wallet.getGetWalletData();
    console.log('walletBalance', fromNano(walletData.balance));
    let exchangeWalletData = await exchange_jetton_wallet.getGetWalletData();
    console.log('exchangeWalletBalance', fromNano(exchangeWalletData.balance));

    // let MyJettonWallet = await exchange.getGetWalletAddress();
    // console.log('MyJettonWallet', MyJettonWallet);
    // run methods on `exchange`
}
