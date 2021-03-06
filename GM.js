// Game Master is hosted by room creator (first to join the room)

// TODO
// - when game is over, reset state to ST_IDLE

class GM {

    static ST_IDLE = 1;
    static ST_START_GAME = 2;
    static ST_WAIT_MIN_PARTICIPANTS = 3;
    static ST_WAIT_FOR_SETUP = 4;
    static ST_WAIT_FOR_PLAYERS = 5;
    static ST_WAIT_FOR_VOTE = 6;
    static ST_WAIT_FOR_NEXT_ROUND = 7;

    static EVT_START_GAME = 1;
    static EVT_PICK = 2;
    static EVT_VOTE = 3;
    static EVT_NEXT_ROUND = 3;
    static EVT_UPDATE_GAME = 4;
    static EVT_QUIT_GAME = 5;

    constructor(dc, id) {
        this.dc = dc;
        this.id = id;
        this.game = new Object();
        this.game.st = GM.ST_IDLE;
    }

    shuffleDeck() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            let j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    popTopCardFromDeck() {//TODO check deck size
        let card = this.deck.pop();
        return card;
    }

    //send game info to each player
    updateGame() {
        let obj = new Object();
        obj['_type'] = GM.EVT_UPDATE_GAME;
        this.players.forEach(player => {
            let hand = this.hands.find(hand => hand.id == player.id);
            if(this.game.st == GM.ST_WAIT_FOR_VOTE || this.game.st == GM.ST_WAIT_FOR_NEXT_ROUND)
                obj['data'] = {'info': this.game, 'players': this.players, 'hand': hand.cards };
            else
                obj['data'] = {'info': this.game, 'players': [player], 'hand': hand.cards };
            
//console.log("====================this.id, player.id, obj=======                                ", this.id, player.id, obj, "                       ========================================");
            this.dc.send(this.id, player.id, obj); 
        });
    }

    removePlayer(id){
        //TODO remove from both this.players and this.hands, and judge id
    }

    pickNextJudge() {
        if(this.game.judgeId == null){//first pick
            this.game.judgeId = this.players[0].id;//TODO randomness
        }else{
            for(let i = 0; i < this.players.length; i++) {
                if(this.players[i].id == this.game.judgeId){
                    if(i+1 < this.players.length)
                        this.game.judgeId = this.players[i+1].id;
                    else
                        this.game.judgeId = this.players[0].id;//back to first player
                    return;
                }
            }
        }
    }

    enrollPlayers(){
        this.hands = new Array();//private cards in hand for each player
        this.players = new Array();//public players info
        this.game.panels_to_fill = -1;//judge wont play
        this.game.bonus_round = false;
        let players = this.dc.getParticipants();
        let idx = 0;
        for (let [key, value] of Object.entries(players)) {//TODO bug: id converted to string
            this.hands.push({ 'id': key, 'cards': [] });
            this.players.push({ 'id': key, 'idx': idx++, 'name': value.displayName, 'score': 0, 'panel0': Card.holder, 'panel1': Card.holder, 'panel2': Card.holder});
            this.game.panels_to_fill += 3;
        }
        return this.hands.length;
    }

    resetRound() {
        this.game.panels_to_fill = -1;//judge wont play
        this.game.bonus_round = false;
        this.players.forEach(player => {
            player.panel0 = Card.holder;
            player.panel1 = Card.holder;
            player.panel2 = Card.holder;
            this.game.panels_to_fill += 3;
        });
    };

    // distribute cards so each player has n cards in hand
    dealCards(n) {
        this.hands.forEach(hand => {
            for(let i = hand.cards.length; i < n; i++) {
                hand.cards.push(this.popTopCardFromDeck());
            }
        });
    }

    setUpCard(pos, card) {
        this.players.forEach(player => {
            switch(pos) {
                case 0:
                    player.panel0 = card;
                    break;
                case 1:
                    player.panel1 = card;
                    break;
                case 2:
                    if(!this.game.bonus_round){//when setup is black, the empty panel is at the end
                        player.panel0 = player.panel1;
                        player.panel1 = card;
                        player.panel2 = Card.holder;
                    }else{//red setup card stays at the end
                        player.panel2 = card;
                    }
                    break;
            }
            this.game.panels_to_fill--;
        });
    }

    replaceCardByIdxFromHand(id, idx, card) {
        if(idx < 0)
            return idx;
        for(let i = 0; i < this.hands.length; i++){
            if(this.hands[i].id == id && idx < this.hands[i].cards.length) {
                if(card)
                    var card = this.hands[i].cards.splice(idx, 1, card);
                else
                    var card = this.hands[i].cards.splice(idx, 1);
                return card[0];
            }
        }
    }

    takeCardByIdxFromHand(id, idx) {
        return this.replaceCardByIdxFromHand(id, idx, null);
    }

    playCard(id, handIdx, panelIdx) {
        if(this.game.panels_to_fill <= 0){
            console.log("GM exception::panels_to_fill : rules violation!");
        }
        for(let i = 0; i < this.players.length; i++) {
            let player = this.players[i];
            if(player.id == id) {
                switch(panelIdx) {
                    case 0:
                        if(player.panel0.id == Card.HOLDER_ID) {//if there's no card in this panel
                            this.game.panels_to_fill--;
                            player.panel0 = this.takeCardByIdxFromHand(id, handIdx);
                        }else{//else put previously selected card back to hand
                            player.panel0 = this.replaceCardByIdxFromHand(id, handIdx, player.panel0);
                        }
                    return;
                    case 1:
                        if(player.panel1.id == Card.HOLDER_ID) {//if there's no card in this panel
                            this.game.panels_to_fill--;
                            player.panel1 = this.takeCardByIdxFromHand(id, handIdx);
                        }else{//else put previously selected card back to hand
                            player.panel1 = this.replaceCardByIdxFromHand(id, handIdx, player.panel1);
                        }
                    return;
                    case 2:
                        if(player.panel2.id == Card.HOLDER_ID) {//if there's no card in this panel
                            this.game.panels_to_fill--;
                            player.panel2 = this.takeCardByIdxFromHand(id, handIdx);
                        }else{//else put previously selected card back to hand
                            player.panel2 = this.replaceCardByIdxFromHand(id, handIdx, player.panel2);
                        }
                    return;
                }
            }
        }
    }

    vote(playerId) {
        for(let i = 0; i < this.players.length; i++) {
            if(this.players[i].id == playerId) {
                this.players[i].score++;
                if(this.game.bonus_round)
                    this.players[i].score++;
                return;
            }
        }
    }

    //set return value to this.game.st
    processEvent(evt, obj=undefined, senderId=undefined) {
        switch(evt) {
        case GM.EVT_START_GAME:
            if(this.enrollPlayers() < 3) {//3 people at least
                return GM.ST_WAIT_MIN_PARTICIPANTS;
            }
        //reset deck
            this.deck = Array.from(Card.cards);
        //shuffle deck
            this.shuffleDeck();
            this.game.judgeId = null;
        //continue to case GM.EVT_NEXT since code is identical
            this.game.st = GM.ST_WAIT_FOR_NEXT_ROUND;

        case GM.EVT_NEXT://next round
            if (this.game.st == GM.ST_WAIT_FOR_NEXT_ROUND) { //if someone wants to start next round
            // reset played cards from previous round
                this.resetRound();
            //distribute 7 cards to each player from deck
                this.dealCards(7);
            //pick a judge for next round
                this.pickNextJudge();
            //pop top card from deck and flip it
                let card = this.popTopCardFromDeck();
                if(card.red){
                    this.game.bonus_round = true;
                    this.setUpCard(2, card);//red setup card is last panel
                    this.game.panels_to_fill--;//judge wont even play
                //wait for players to pick 2 cards each
                    return GM.ST_WAIT_FOR_PLAYERS;
                }else{
                    this.game.bonus_round = false;
                    this.setUpCard(1, card);//1st setup card is middle card
                //wait for judge to play
                    return GM.ST_WAIT_FOR_SETUP;
                }
            }else{
                console.log("GM exception : invalid next!");
            }
            break;

        case GM.EVT_PICK://one player has picked a card. why ?
            if(this.game.st == GM.ST_WAIT_FOR_SETUP && senderId == this.game.judgeId && obj.pos != 1) {//if judge has picked the set-up card
                let card = this.takeCardByIdxFromHand(senderId, obj.idx);
                this.setUpCard(obj.pos, card);
                return GM.ST_WAIT_FOR_PLAYERS;//start the game for other players
            }else if ((this.game.st == GM.ST_WAIT_FOR_PLAYERS) &&// if game has started,
                        (senderId != this.game.judgeId) &&       // all players can play except judge.
                        (this.game.bonus_round ^ (obj.pos == 2))) {   // Also pos 2 is only played on non-bonus round
                this.playCard(senderId, obj.idx, obj.pos);
                if(this.game.panels_to_fill == 0) {//everyone has played, lets move to the vote
                    return GM.ST_WAIT_FOR_VOTE;
                }else{
                    return GM.ST_WAIT_FOR_PLAYERS;
                }
            }else{
                console.log("GM exception : invalid pick!");
            }
            break;

        case GM.EVT_VOTE:
            if (this.game.st == GM.ST_WAIT_FOR_VOTE && senderId == this.game.judgeId && obj.id != this.game.judgeId) { //if judge has voted (and not for h..self)
                this.vote(obj.id);
                return GM.ST_WAIT_FOR_NEXT_ROUND;
            }else{
                console.log("GM exception : invalid vote!");
            }
            break;

        case GM.EVT_QUIT_GAME:
            if(senderId == this.id){// player hosting GM is leaving, game over.
                return GM.ST_IDLE;
            }else{
                this.removePlayer(senderId);
            }

        default:
            console.log("GM exception : invalid action!");
            break;
        }

        return this.game.st;
    }

    startGame() {
        this.game.st = this.processEvent(GM.EVT_START_GAME);
        if(this.game.st != GM.ST_WAIT_MIN_PARTICIPANTS)//game has started
            this.updateGame();
        return this.game.st;
    }

    processObjectReceived(id, obj) {
        //console.log(obj.data);
        this.game.st = this.processEvent(obj._type, obj.data, id);
        this.updateGame();
    }
}
