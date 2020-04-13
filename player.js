class Player {

    //TODO security:
    // - stringify
    // - find a way to identify GM id
    // - only accept msg from GM
    // - XSS any field
    //TODO feature:
    // - register a listener in DC to receive events
    static colors = ['green', 'yellow', 'red', 'blue', 'orange', 'lime', 'silver', 'maroon', 'aqua', 'purple'];

    constructor(dc) {
        this.dc = dc;
        this.id = this.dc.getMyId();
        this.dc.setPlayer(this);

        this.game = new Vue({
            el: '#game',
            data: {
                players: [],
                cards: [],
                isJudge: false,
                judgeId: null,
                status: GM.ST_IDLE,
                myPlayerid: this.id,
                isGM: false,
            },
            methods: {
                playerColor: function(playeridx) {
                    return Player.colors[playeridx % Player.colors.length];//TODO doesnt work
                }
            }
        });
    }

    updateHand(cards) {
        this.game.cards.splice(0, this.game.cards.length, ...cards);
    }

    getPanelUrlFromCards(playerId, card) {
        if(card.state == Card.FACE_UP) {
            return card.url;
        }else if(playerId == this.id && card.state >= 0 && card.state < this.game.cards.length) {//we display our panels
            return this.game.cards[card.state].url;
        }else {
            return 'card.png';
        }
    }

    updateGame(game) {
        this.game.isJudge = (this.id == game.info.judgeId);
        this.game.judgeId = game.info.judgeId;
        this.game.status = game.info.st;
        this.game.players.splice(0,this.game.players.length);
        game.players.forEach(player => {//TODO replace forEach with splice(, , ...game.players)
            this.game.players.push({ 'id': player.id, 'idx': player.idx, 'name': player.displayName, 'score': player.score, 'panel0': player.panel0, 'panel1': player.panel1, 'panel2': player.panel2 })
        });
    }

    startGame() {
        if(this.game.status == GM.ST_IDLE || this.game.status == GM.ST_WAIT_MIN_PARTICIPANTS || this.game.isGM) {
            this.GMid = this.id;
            this.gm = new GM(this.dc, this.id);
            this.game.isGM = true;
            this.game.status = this.gm.startGame();
            if(this.game.status == GM.ST_WAIT_MIN_PARTICIPANTS) {//failed to start game
                this.game.isGM = false;
                this.GMid = null;
                this.game.isJudge = false;
                this.game.judgeId = null;
                delete this.gm;
            }
        }
    }

    pickCard(idx, pos) {
        let obj = new Object();
        obj['_type'] = GM.EVT_PICK;
        obj['data'] = {'idx': idx, 'pos': pos};
        this.sendToGM(this.id, obj);
    }

    vote(playerId) {
        let obj = new Object();
        obj['_type'] = GM.EVT_VOTE;
        obj['data'] = {'id': playerId};
        this.sendToGM(this.id, obj);
    }

    nextRound(playerId) {
        let obj = new Object();
        obj['_type'] = GM.EVT_NEXT;
        obj['data'] = {'id': playerId};
        this.sendToGM(this.id, obj);
    }

    quitGame() {
        this.game.status = GM.ST_IDLE;
        this.game.isGM = false;
        this.GMid = null;
        this.game.isJudge = false;
        this.game.judgeId = null;
        delete this.gm;
        this.game.players.splice(0,this.game.players.length);
        this.game.cards.splice(0, this.game.cards.length);
    }

    sendToGM(senderId, obj) {
        if(this.game.isGM)
            this.gm.processObjectReceived(senderId, obj);
        else if(this.GMid)
            this.dc.send(senderId, this.GMid, obj);
    }

    processMessageReceived(id, strobj) {
        if(this.GMid == null)
            this.GMid = id;
        let obj = JSON.parse(strobj);//TODO YOLO
        if(id == this.GMid){
            switch(obj._type) {
                case GM.EVT_UPDATE_HAND:
                    console.log(obj.data);
                    this.updateHand(obj.data);
                break;
                case GM.EVT_UPDATE_GAME:
                    console.log(obj.data);
                    this.updateGame(obj.data);
                break;
            }
        }else if(this.game.isGM){
            this.gm.processObjectReceived(id, obj);
        }
    }
}