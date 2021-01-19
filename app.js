console.log(`Start`);
const {VK} = require('vk-io');
const vk = new VK({
    token: ``,//токен группы
    apiLimit: 20,
    apiMode: 'parallel'
});
const request = require('prequest');
let users = require('./database/users.json');
const commands = [];
const groupId = ;//id группы
const {updates, snippets} = vk;
async function saveUsers() {
    require('fs').writeFileSync('./database/users.json', JSON.stringify(users, null, '\t'));
    return true;
}
const utils = {
    random: (x, y) => {
        return y ? Math.round(Math.random() * (y - x)) + x : Math.round(Math.random() * x);
    }
}
setInterval(async ()=>{
    await users.filter(x=> x.ban == false && x.token!= null && x.task.length>=1).map(x=>{
        x.task.filter(q=>q.active == true && q.timer<=Date.now()).map(q=>{
            const rq  = request(`https://api.vk.com/method/messages.send?peer_id=${q.peerId}&message=${encodeURIComponent(q.msg)}&v=5.126&access_token=${x.token}&random_id=0`).catch((error) => {
                console.log(error);
            });
            if(rq.error.error_code == 5) x.token = null;
            if(!q.rand) q.timer=Date.now()+q.time*1000;
            else q.timer=Date.now()+q.time*1000+utils.random(0,q.time)*1000;
        });
    });
},300);
setInterval(async () => {
    await saveUsers();
}, 30000);
const cmd = {
    one: (p, f) => {
        commands.push([p, f]);
    }
}
vk.updates.start().catch(console.error);
updates.on('message_new', async (message) => {
    if (Number(message.senderId) <= 0) return;
    if (/\[club...\|(.*)\]/i.test(message.text)) message.text = message.text.replace(/\[club...\|(.*)\]/ig, '').trim();//точки заменить на id группы club12345

    if (!users.find(x => x.id === message.senderId)) {
        const [user_info] = await vk.api.users.get({user_id: message.senderId});
        const date = new Date();
        users.push({
            id: message.senderId,
            uid: users.length,
            tag: user_info.first_name,
            notification: false,
            token: null,
            limit: 3,
            lvl: 0,
            ban: false,
            task: []
        })
    }

    message.user = users.find(x => x.id === message.senderId);
    const bot = (text, params) => {
        return message.send(`${message.user.mention ? `@id${message.user.id} (${message.user.tag})` : `${message.user.tag}`}, ${text}`, params);
    }
    const command = commands.find(x => x[0].test(message.text));
    if (!command) {
        if (!message.isChat) return bot(`такой команды не существует, отправь «помощь» что бы узнать мои команды. 📋 `);
        if (message.isChat) return;
    }
    message.args = message.text.match(command[0]);
    await command[1](message, bot);

    const [user_info] = await vk.api.users.get({user_id: message.senderId});
    console.log(`${user_info.first_name} (ID: ${message.user.uid}): ${message.text}`)
});
const getRandomId = () => (Math.floor(Math.random() * 10000) * Date.now());
cmd.one(/^(?:начать|токен|token)$/i, async (message, bot) => {
    return bot(`Для начала пользования ботом, введите свой токен\nЕго можно получить на сайте https://vkhost.github.io/\n при получении токена выбирайте kateMobile
    Затем напишите команду token [ссылка/токен], при возникновении доп.вопросов напишите помощь\nВнимание!Выдайте разрешение на сообщения, если оно отсутсвует`);
});
cmd.one(/^(?:токен|token)\s([^]+)$/i, async (message, bot) => {
    if(message.args[1].indexOf("https://oauth.vk.com/blank.html#access_token=")!=-1) {
        message.args[1] = message.args[1].substring(message.args[1].indexOf(`=`) + 1, message.args[1].indexOf(`&`))
    }
    const rq = await request(`https://api.vk.com/method/messages.send?peer_id=-${groupId}&message=good&v=5.126&access_token=${message.args[1]}&random_id=0`).catch((error) => {
        return bot(`Ссылка/Токен введены не верно!`)
    });
    if (rq.error) return bot(`Ссылка/Токен введены не верно!`);
    message.user.token = message.args[1]
});
cmd.one(/^(?:good)$/i, async (message, bot) => {
    return bot(`Hello => Тут должна быть клавиатура`,{keyboard: JSON.stringify(
            {
                "inline": true,
                "buttons": [
                    [{
                        "action": {
                            "type": "text",
                            "payload": "{}",
                            "label": "Помощь"
                        },
                        "color": "positive"
                    }],
                ]
            })})
});
cmd.one(/^(?:помощь)$/i, async (message, bot) => {
    return bot(`команды:
        начать
        токен
        токен [токен/ссылка]
        создать слот
        задание [0-99]
        задание [0-99] вкл/выкл
        задание [0-99] текст [текст]
        задание [0-99] время [часы] [минуты] [секунды]
        задание [0-99] путь [peerId]
        задание [0-99] погрешность вкл/выкл
        получить диалоги
        репорт [сообщение]
        `)
});
cmd.one(/^(?:zz)\s([^]+)$/i, async (message, bot) => {
    if (message.user.lvl < 3) return;
    try {
        const result = eval(message.args[1]);

        if (typeof (result) === 'string') {
            return bot(`string: ${result}`);
        } else if (typeof (result) === 'number') {
            return bot(`number: ${result}`);
        } else {
            return bot(`${typeof (result)}: ${JSON.stringify(result, null, '&#12288;\t')}`);
        }
    } catch (e) {
        console.error(e);
        return bot(`ошибка:
		${e.toString()}`);
    }
});
cmd.one(/^(?:задани(е|я))\s([0-9]+)$/i, async (message, bot) => {
    if(message.user.task.length==0) return bot(`У вас отсутствуют слоты заданий, для создание нового введите "создать слот"`);
    if((Number(message.args[2])>=message.user.task.length)||(Number(message.args[2])<0))return bot(`Введен не верный номер задания, попробуйте испотльзовать число от 0 до ${message.user.task.length-1}`);
    let task = message.user.task[message.args[2]];
    return bot(`Информация о задании №${message.args[2]}:
    Message: ${task.msg},
    PeerId: ${task.peerId},
    Time: ${task.time} сек,
    Active: ${task.active},
    Random: ${task.rand}
    `);
})
cmd.one(/^(?:создать слот)$/i, async (message, bot) => {
    if(message.user.task.length>=message.user.limit) return bot(`Вы достигли лимита слотов, обратитесь к администратору для увеличения лимита`);
    message.user.task.push({
        id: message.user.task.length,
        peerId: message.peerId,
        msg: `test`,
        time: 20,
        timer: Date.now() + 20*1000,
        active: false,
        rand: false
    });
    return bot(`слот успешно создан`);
});
cmd.one(/^(?:задани(е|я))\s([0-9]+)\s(вкл|выкл)$/i, async (message, bot) => {
    if(message.user.task.length==0) return bot(`У вас отсутствуют слоты заданий, для создание нового введите "создать слот"`);
    if((Number(message.args[2])>=message.user.task.length)||(Number(message.args[2])<0))return bot(`Введен не верный номер задания, попробуйте испотльзовать число от 0 до ${message.user.task.length-1}`);
    if(message.args[3]==`вкл`)message.user.task[message.args[2]].active = true;
    if(message.args[3]==`выкл`)message.user.task[message.args[2]].active = false;
});
cmd.one(/^(?:задани(е|я))\s([0-9]+)\s(погрешность)\s(вкл|выкл)$/i, async (message, bot) => {
    if(message.user.task.length==0) return bot(`У вас отсутствуют слоты заданий, для создание нового введите "создать слот"`);
    if((Number(message.args[2])>=message.user.task.length)||(Number(message.args[2])<0))return bot(`Введен не верный номер задания, попробуйте испотльзовать число от 0 до ${message.user.task.length-1}`);
    if(message.args[4]==`вкл`)message.user.task[message.args[2]].rand = true;
    if(message.args[4]==`выкл`)message.user.task[message.args[2]].rand = false;
});
cmd.one(/^(?:задани(е|я))\s([0-9]+)\s(текст)\s([^]+)$/i, async (message, bot) => {
    if(message.user.task.length==0) return bot(`У вас отсутствуют слоты заданий, для создание нового введите "создать слот"`);
    if((Number(message.args[2])>=message.user.task.length)||(Number(message.args[2])<0))return bot(`Введен не верный номер задания, попробуйте испотльзовать число от 0 до ${message.user.task.length-1}`);
    message.user.task[message.args[2]].msg = message.args[4];
});
cmd.one(/^(?:задани(е|я))\s([0-9]+)\s(время)\s([0-9]+)\s([0-9]+)\s([0-9]+)$/i, async (message, bot) => {
    if(message.user.task.length==0) return bot(`У вас отсутствуют слоты заданий, для создание нового введите "создать слот"`);
    if((Number(message.args[2])>=message.user.task.length)||(Number(message.args[2])<0))return bot(`Введен не верный номер задания, попробуйте испотльзовать число от 0 до ${message.user.task.length-1}`);
    if(message.args[6]>=60)message.args[6] = 59;
    if(message.args[5]>=60)message.args[5] = 59;
    if(message.args[4]>=24)message.args[4]= 23;
    message.user.task[message.args[2]].time=Number(Number(message.args[6])+Number(message.args[5])*60+Number(message.args[4])*3600);
});
cmd.one(/^(?:задани(е|я))\s([0-9]+)\s(путь)\s([^]+)$/i, async (message, bot) => {
    if(!Number(message.args[4]))return bot(`Введите числовое значение`);
    if(message.user.task.length==0) return bot(`У вас отсутствуют слоты заданий, для создание нового введите "создать слот"`);
    if((Number(message.args[2])>=message.user.task.length)||(Number(message.args[2])<0))return bot(`Введен не верный номер задания, попробуйте испотльзовать число от 0 до ${message.user.task.length-1}`);
    message.user.task[message.args[2]].peerId = message.args[4];
});
cmd.one(/^(?:репорт|жалоба)\s([^]+)$/i, async (message, bot) => {
    vk.api.messages.send({
        //1234 на свои id
        peer_id: 1234, forward_messages: message.id, message: `[⛔] НОВЫЙ РЕПОРТ »
	- 👤 Игрок: @id${message.user.id}(${message.user.tag})
	- 📌 ID: ${message.user.uid}
	- 💬 Сообщение: ${message.args[1]}
	- 🔥 Ответ [id] [текст]`, random_id: getRandomId()
    });
    return bot(`✅Репорт успешно отправлен.`);
});
cmd.one(/^(?:ответ)\s([0-9]+)\s([^]+)$/i, async (message, bot) => {
    if (message.user.id !== 1234) return;//1234 на свои id
    const user = await users.find(x => x.uid === Number(message.args[1]));
    if (!user) return;
    vk.api.messages.send({
        user_id: user.id, message: `✅Поступил ответ на ваш репорт\n💬 Ответ: ${message.args[2]}`, random_id: getRandomId()
    });
    return bot(`✅Вы успешно ответили на репорт\n.`);
});
cmd.one(/^(?:получить диалоги)$/i, async (message, bot) => {
    const rq  = await request(`https://api.vk.com/method/messages.getConversations?offset=0&count=10&v=5.126&filter=all&access_token=${message.user.token}`).catch((error) => {
        console.log(error);
    });
    console.log(rq.response);
    if (rq.error) return bot(`Ошибка при получении бесед`);
    let rq1 = rq.response.items;
    let text = ``;
    let cc = 0;
    for(let i = 0;i<10;i++){
        if(rq.response.items[i]) {
            console.log(rq.response.items[i])
            if (rq.response.items[i].conversation.peer.type == `chat`) {
                text += `${rq.response.items[i].conversation.peer.id}|${rq.response.items[i].conversation.chat_settings.title}\n`
                cc++;
            }
            if (cc === 10) break;
        }
    }
    return bot(`${text}\n путь к беседе|название беседы\nВ выборке участвовали беседы из 10 последних диалогов`);
});