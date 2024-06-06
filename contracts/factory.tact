import "@stdlib/deploy";
import "./exchange";

message InitAdd{
    jetton: Address;
    MyJettonWallet: Address;
    PairJettonWallet: Address;
    queryId: Int;
    amount: Int;
    ton: Int;
}

message CreatePair{
    jetton: Address;
}

struct PairInfo{
    pairAddress: Address;
    isSetMyJettonWallet: Bool = false;
}

contract factory with Deployable{
    admin: Address;
    queryId: Int as uint64;
    Pairs: map<Address, PairInfo>;

    init(admin: Address){
        self.admin = admin;
        self.queryId = 0;
    }

    receive(msg: InitAdd){
        if (self.Pairs.get(msg.jetton).pairAddress == null){
            let winit: StateInit = initOf main(msg.jetton, myAddress());
            self.Pairs.set(msg.jetton, contractAddress(winit));
        }

        let pair: PairInfo = self.Pairs.get(msg.jetton)!!;

        if (!pair.isSetMyJettonWallet){
            self.SetPairJettonWallet(msg.PairJettonWallet, msg.jetton);
        } 

        self.initAddLiqudity(msg.MyJettonWallet, msg.queryId, msg.amount, msg.jetton, msg.ton);
    }   


    // receive(msg: CreatePair){
    //     let pair: StateInit = initOf main(msg.jetton, myAddress());
    //     let pairAddress: Address = contractAddress(pair);
    //     send(SendParameters{
    //             to: pairAddress, 
    //             value: ton("0.05"),
    //             mode: 0, 
    //             bounce: false,
    //             body: Deploy{
    //                 queryId: self.queryId,
    //             }.toCell(),
    //         });
    //     self.queryId += 1;

    //     let updatePairInfo: PairInfo = PairInfo{
    //         pairAddress: pairAddress,
    //         isSetMyJettonWallet: false,
    //     };
    //     self.Pairs.set(msg.jetton, updatePairInfo);
    // }

    fun SetPairJettonWallet(jetton: Address, PairJettonWallet: Address){
        let initPairInfo: PairInfo = PairInfo{
            pairAddress: newAddress(0, 0),
            isSetMyJettonWallet: false,
        };
        let pair: PairInfo = self.Pairs.get(jetton) == null ? initPairInfo : self.Pairs.get(jetton)!!;
        require(pair.pairAddress != newAddress(0, 0), "Pair not found");
        send(SendParameters{
            to: pair.pairAddress, 
            value: 0,
            mode: 0, 
            bounce: false,
            body: SetMyJettonWallet{
                wallet: PairJettonWallet,
            }.toCell(),
        });
        let updatePairInfo: PairInfo = PairInfo{
            pairAddress: pair.pairAddress,
            isSetMyJettonWallet: true,
        };
        self.Pairs.set(jetton, updatePairInfo);
    }

    fun initAddLiqudity(MyJettonWallet: Address, queryId: Int, amount: Int, to: Address, ton: Int){
        send(SendParameters{
                to: MyJettonWallet, 
                value: ton("0.3"),
                mode: SendRemainingValue, 
                bounce: false,
                body: TokenTransfer{
                    queryId: queryId,
                    amount: amount,
                    destination: to,
                    response_destination: myAddress(),
                    custom_payload: self.createOffchainContent("custom"),
                    forward_ton_amount: ton,
                    forward_payload: self.createOffchainContent("forward").asSlice()
            }.toCell()
        });
    }
        
    fun createOffchainContent(pram: String): Cell {
        let s:StringBuilder = beginStringFromBuilder(beginCell().storeBool(true).storeUint(0, 32));
        s.append(pram);
        return s.toCell();
    }

    get fun getPair(jetton: Address): PairInfo{
        return self.Pairs.get(jetton)!!;
    }

}