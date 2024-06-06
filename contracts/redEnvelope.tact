import "@stdlib/deploy";
import "./jetton";

struct EnvelopeInfo{
    jetton: Address;
    MyJettonWallet: Address;
    content: Slice;
    queryId: Int;
    min: Int;
}

message GetEnvelope{
    to: Address;
    queryId: Int;
}

message SetMyJettonWallet{
    wallet: Address;
}

message SendToken{
    to: Address;
    amount: Int;
    queryId: Int;
    value: Int;
}

contract TonEnvelpoe with Deployable{
    amount: Int;
    size: Int;
    envelope: EnvelopeInfo;

    init(amount: Int, size: Int, envelope: EnvelopeInfo){
        self.amount = amount;
        self.size = size;
        self.envelope = envelope;
    }

}

contract redEnvelope with Deployable{
    amount: Int;
    size: Int;
    envelope: EnvelopeInfo;
    MyJettonWallet: Address;
    min: Int;
    flag: Bool;

    init(amount: Int, size: Int, envelope: EnvelopeInfo, min: Int){
        self.amount = amount;
        self.size = size;
        self.envelope = envelope;
        self.MyJettonWallet = newAddress(0, 0);
        self.min = min;
        self.flag = false;
    }


    receive(msg: TokenExcesses){
        send(SendParameters{
            to: newAddress(0, 0),
            value: ton("0.05"),
            mode: 0, 
            bounce: false,
            body: "The excesses of Ton has been sent!".asComment()
        });
    }

    receive(msg: SetMyJettonWallet){
        let ctx: Context = context();
        self.MyJettonWallet = msg.wallet;
    }

    receive(msg: GetEnvelope){
        let queryId: Int = msg.queryId;
        let red: Int = self.getRedEnvelope();
        self.sendJetton(msg.to, red, queryId, ton("0.2"));
        self.flag = true;
    }

    receive(msg: SendToken){
        let ctx: Context = context();
        self.sendJetton(msg.to, msg.amount, msg.queryId, msg.value);
    }

    fun getRedEnvelope(): Int{
        let red: Int = self.Rund(self.amount, self.min, self.size);
        self.amount = self.amount - red;
        self.size = self.size - 1;

        return red;
    }

    fun sendJetton(to: Address, amount: Int, queryId: Int, value: Int){
        require(amount > 0, "The amount of Jetton is not enough!");
        require(to != newAddress(0, 0), "The address is not correct!");

        send(SendParameters{
            to: self.MyJettonWallet, 
            value: ton("0.3") + value,
            mode: SendRemainingValue, 
            bounce: false,
            body: TokenTransfer{
                queryId: queryId,
                amount: amount,
                destination: to,
                response_destination: myAddress(),
                custom_payload: self.createOffchainContent("custom"),
                forward_ton_amount: value,
                forward_payload: self.createOffchainContent("forward").asSlice()
            }.toCell()
        });
    }

    get fun MyJettonWallet(): Address{
        return self.MyJettonWallet;
    }

    get fun flag(): Bool{
        return self.flag;
    }

    get fun amount(): Int{
        return self.amount;
    }

    get fun size(): Int{
        return self.size;
    }

    get fun Rund(amount: Int, min: Int, size: Int): Int{
        if(size == 1) {
            return amount;
        } else {
            let max: Int = amount * 2 / size;
            // nativeRandomizeLt(); 
            nativeRandomize(amount); 
            let red: Int = randomInt() % max;

            return red < min ? min + red : red;
        }
    }

    fun createOffchainContent(pram: String): Cell {
        let s:StringBuilder = beginStringFromBuilder(beginCell().storeBool(true).storeUint(0, 32));
        s.append(pram);
        return s.toCell();
    }
}