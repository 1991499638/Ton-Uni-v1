import "@stdlib/deploy";
import "./jetton";

message TonToSwapJetton{
    sender: Address;
    queryId: Int;
}

struct Params {
    name: String = "test";
    description: String = "This is the first jetton from test1";
    symbol: String = "T2";
    image: String = "https";
}

message SetMyJettonWallet{
    wallet: Address;
}


contract main with Jetton, Deployable{
    jetton: Address;
    totalSupply: Int as coins; // Already set initially 
    mintable: Bool;
    owner: Address;
    content: Cell;
    max_supply: Int; // This is not in the TEP-74 interface
    jettonReserve: Int;
    LP: map<Address, Int>;

    MyJettonWallet: Address;
    isSetMyJettonWallet: Bool;

    init(jetton: Address, owner: Address){
        self.jetton = jetton;
        self.owner = owner;
        self.MyJettonWallet = newAddress(0, 0);
        self.isSetMyJettonWallet = false;

        self.totalSupply = 0;
        self.mintable = true;
        self.content = Params{}.toCell();
        self.max_supply = ton("123456766689011");

        self.jettonReserve = 0;

    }
        
    /* 
     *   update jetton wallet
    */
    receive(msg: SetMyJettonWallet){
        let ctx: Context = context();
        require(ctx.sender == self.owner, "The sender is not the owner!");
        require(self.isSetMyJettonWallet == false, "The jetton wallet has been set!");
        self.MyJettonWallet = msg.wallet;
        self.isSetMyJettonWallet = true;
    }

    receive(msg: TokenExcesses){
        send(SendParameters{
            to: self.owner, 
            value: ton("0.05"),
            mode: 0, 
            bounce: false,
            body: "The excesses of Ton has been sent!".asComment()
        });
    }

    /* 
     *   add Liqudity 
    */
    fun addLiqudity(owner: Address, jettonAmount: Int): Bool{
        let ctx: Context = context();
        let tonAmount: Int = ctx.value;
        // acssert Liqudity prams are not 0, and the user has enough Ton and Jetton;
        if ( tonAmount == 0 || jettonAmount == 0) {
            return false;
        }

        let tonReserve: Int = myBalance() - tonAmount;
        let total_liquidity: Int = self.totalSupply;

        if (total_liquidity > 0) {
            require(tonAmount > 0 && jettonAmount > 0, "The amount of Ton and Jetton is not enough!");
            
            let lpAmountBaseTon: Int = tonAmount * total_liquidity / tonReserve;
            let lpAmountBaseJetton: Int = jettonAmount * total_liquidity / self.jettonReserve;
            let lpAmountAdd: Int = lpAmountBaseTon < lpAmountBaseJetton ? lpAmountBaseTon : lpAmountBaseJetton;
            lpAmountAdd = lpAmountBaseJetton;

            self.mint(owner, lpAmountAdd, myAddress());
            if (self.LP.get(owner) != null) {
                let lpRes: Int = self.LP.get(owner)!!;
                lpRes += lpAmountAdd;
                self.LP.set(owner, lpRes);
            } else {
                self.LP.set(owner, lpAmountAdd);
            }
            self.jettonReserve += jettonAmount;

            return true;
        } else {
            require(self.jetton != newAddress(0, 0), "The owner is not set!");
            let lpAmount: Int = tonAmount;
            self.mint(owner, lpAmount, myAddress());
            self.LP.set(owner, lpAmount);
            self.jettonReserve += jettonAmount;

            return true;
        }
    }
    
    receive(msg: TokenNotification){

        let ctx: Context = context();
        let jettonAmount: Int = msg.amount;

        let lpWallet: Address = self.get_wallet_address(myAddress());
        
        // // add Liqudity
        if (msg.forward_payload == self.createOffchainContent("addLiqudity").asSlice()) {
            require(ctx.sender == self.MyJettonWallet, "sender error.");
            let result: Bool = self.addLiqudity(msg.from, jettonAmount);
        }

        // // jetton to swap Ton
        if (msg.forward_payload == self.createOffchainContent("JettonToSwapTon").asSlice()) {
            require(ctx.sender == self.MyJettonWallet, "sender error.");
            let tonAmount: Int = self.calculate(jettonAmount, self.jettonReserve, myBalance() - ctx.value);
            send(SendParameters{
                to: msg.from, 
                value: tonAmount,
                mode: 0, 
                bounce: false,
                body: "Jetton to swap Ton success!".asComment()
            });
            self.jettonReserve += jettonAmount;
        }

        // remove Liqudity
        if (msg.forward_payload == self.createOffchainContent("removeLiqudity").asSlice()) {
            require(lpWallet == ctx.sender, "The sender is not the LP wallet address of exchange! ");
            let result: Bool = self.removeLiqudity(msg.queryId, msg.amount, msg.from);
        }
    }

    /* 
     *  remove Liqudity
    */
    fun removeLiqudity(queryId: Int, amount: Int, sender: Address): Bool{
        let ctx: Context = context();
        let totalLP: Int = self.LP.get(sender) == null ? 0 : self.LP.get(sender)!!;
        require(amount <= totalLP, "The amount of LP jetton is not enough!");

        let totalSupply: Int = self.totalSupply;
        let tonReserve: Int = myBalance() - ctx.value;
        require(totalSupply >= 0, "totalSupply is not enough!");

        let tonAmount: Int = amount * tonReserve / totalSupply;
        let jettonAmount: Int = amount * self.jettonReserve / totalSupply;
        
        // remove the LP jetton from the user
        self.LP.set(sender, totalLP - amount);
        self.totalSupply -= amount;

        // send the Ton and Jetton to the user
        self.sendJetton(sender, jettonAmount, queryId, tonAmount);

        return true;
    }

    receive(msg: TonToSwapJetton){
        let ctx: Context = context();
        require(msg.sender == ctx.sender, "The sender is not the same as the user!");

        let tonAmount: Int = ctx.value;
        let tonReserve: Int = myBalance() - tonAmount;

        // calculate the amount of Jetton to be sent
        let jettonAmount: Int = self.calculate(tonAmount, tonReserve, self.jettonReserve);

        // send the Jetton to the user
        self.sendJetton(msg.sender, jettonAmount, msg.queryId, tonAmount);
    }

    fun sendJetton(to: Address, amount: Int, queryId: Int, value: Int){
        let ctx: Context = context();
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
        self.jettonReserve -= amount;
    }

    /* 
     *   static function
     */

    fun createOffchainContent(pram: String): Cell {
        let s:StringBuilder = beginStringFromBuilder(beginCell().storeBool(true).storeUint(0, 32));
        s.append(pram);
        return s.toCell();
    }

    /* 
     *   get function
     */
    get fun calculate(inputAmount: Int, inputReserve: Int, outputReserve: Int): Int{
        let inputAmountWithFee: Int = 99 * inputAmount;
        let numerator: Int = outputReserve * inputAmountWithFee;
        let denominator: Int = inputReserve * 100 + inputAmountWithFee;
        
        return numerator / denominator;
    }

    // test function
    // ===================
    get fun getTotalSupply(): Int{
        return self.totalSupply;
    }

    get fun getBalance(pram: Address): Int{
        let res: Int = self.LP.get(pram) == null ? 0 : self.LP.get(pram)!!;
        return res;
    }

    get fun getMyBalance(): Int{
        return myBalance();
    }

    get fun getJettonReserve(): Int{
        return self.jettonReserve;
    }

    get fun getOwner(): Address{
        return self.owner;
    }

    get fun getJetton(): Address{
        return self.jetton;
    }

    get fun getMyAddress(): Address{
        return myAddress();
    }   

    get fun getEwallte(): Address{
        let jettonWallet: Address = contractAddress(initOf JettonDefaultWallet(self.jetton, myAddress()));
        return jettonWallet;
    }
    get fun getWallte(master: Address, owner: Address): Address{
        let lpWallet: Address = contractAddress(initOf JettonDefaultWallet(master, owner));
        return lpWallet;
    }
}