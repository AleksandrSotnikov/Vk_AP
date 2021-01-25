console.log(`Start`);
const {VK} = require('vk-io');
const vk = new VK({
    token: ``,
    apiLimit: 20,
    apiMode: 'parallel'
});
const request = require('prequest');
let users = require('./database/users.json');
let qiwidon = require('./database/qiwidon.json');
const commands = [];
const groupId = 197613406;
const admin = 312755394;
const {updates, snippets} = vk;
const QIWI = require("@qiwi/bill-payments-node-js-sdk");
const qiwiApi = new QIWI("");
async function saveUsers() {
    require('fs').writeFileSync('./database/users.json', JSON.stringify(users, null, '\t'));
    require('fs').writeFileSync('./database/qiwidon.json', JSON.stringify(qiwidon, null, '\t'));
    return true;
}
const utils = {
    random: (x, y) => {
        return y ? Math.round(Math.random() * (y - x)) + x : Math.round(Math.random() * x);
    }
}
setInterval(async()=>{
    await qiwidon.filter(x=> x.addingAccount == false).map(x=> {
        let user = users.find(q => q.id == x.vkId)
        if (!user) return;
        qiwiApi.getBillInfo(x.billId).then(data => {
            if (data.status.value == "PAID") {
                if (data.comment == "+1") {
                    user.limit += 1;
                }
                x.addingAccount = true;
                vk.api.messages.send({
                    user_id: admin, message: `[УВЕДОМЛЕНИЕ]
					Игрок: vk.com/id${user.id} приобрел ${data.comment}`, random_id: getRandomId()
                });
                vk.api.messages.send({
                    user_id: user.id, message: `[УВЕДОМЛЕНИЕ]
					💰Вы успешно оплатили💰
                    🔥${data.comment} выдан на аккаунт🔥`, random_id: getRandomId()
                });
            }
        });
    });
    },60000);
setInterval(async ()=>{
    await users.filter(x=> x.ban === false && x.token!= null && x.task.length>=1 ).map(x=>{
        x.task.filter(q=>q.active === true && q.timer<=Date.now() && (q.count===-1||q.count>0)).map(q=>{
            const rq  = request(`https://api.vk.com/method/messages.send?peer_id=${q.peerId}&message=${encodeURIComponent(q.msg)}&v=5.126&access_token=${x.token}&random_id=0`).catch((error) => {
                console.log(error);
            });
            if(rq.error.error_code == 5) x.token = null;
            if(!q.rand) q.timer=Date.now()+q.time*1000;
            else q.timer=Date.now()+q.time*1000+utils.random(0,q.time)*1000;
            if(q.count>0)q.count-=1;
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
    if (/\[club197613406\|(.*)\]/i.test(message.text)) message.text = message.text.replace(/\[club197613406\|(.*)\]/ig, '').trim();

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
            task: [],
            current: -1
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
    console.log(`${user_info.first_name} (ID: ${message.user.id}): ${message.text}`)
});
const getRandomId = () => (Math.floor(Math.random() * 10000) * Date.now());
// \s([^]+) \s([0-9]+)\s(.*)
cmd.one(/^(?:начать|токен|token)$/i, async (message, bot) => {
    return bot(`Для начала пользования ботом, введите свой токен\nЕго можно получить на сайте https://vkhost.github.io/\n при получении токена выбирайте kateMobile
    Затем напишите команду token [ссылка/токен], при возникновении доп.вопросов напишите помощь`);
});
cmd.one(/^(?:токен|token)\s([^]+)$/i, async (message, bot) => {
    if(message.args[1].indexOf("https://oauth.vk.com/blank.html#access_token=")!==-1) {
        message.args[1] = message.args[1].substring(message.args[1].indexOf(`=`) + 1, message.args[1].indexOf(`&`))
    }
    const rq = await request(`https://api.vk.com/method/messages.send?peer_id=-${groupId}&message=good&v=5.126&access_token=${message.args[1]}&random_id=0`).catch((error) => {
        return bot(`Ссылка/Токен введены не верно!`)
    });
    if (rq.error) return bot(`Ссылка/Токен введены не верно!`);
    message.user.token = message.args[1]
});
cmd.one(/^(?:good)$/i, async (message, bot) => {
    return bot(`Hello => Тут должна быть клавиатура`)
});
cmd.one(/^(?:помощь)$/i, async (message, bot) => {
    return bot(`команды:
        начать
        токен
        токен [токен/ссылка]
        создать слот
        задание [0-99]
        задание [0-99] удалить
        задание [0-99] вкл/выкл
        задание [0-99] текст [текст]
        задание [0-99] время [часы] [минуты] [секунды]
        задание [0-99] путь [peerId]
        задание [0-99] погрешность вкл/выкл
        задание [0-99] количество [0-99]/выкл
        задание [0-99] [путь] [текст] [время-ч] [время-м] [время-с]
        задание [0-99] [путь] [текст] [время-ч] [время-м] [время-с] [погрешность]
        задание [0-99] [путь] [текст] [время-ч] [время-м] [время-с] [кол-во сообщений]
        получить диалоги
        список заданий
        репорт [сообщение]
        донат
        `)
});
cmd.one(/^(?:апомощь)$/i, async (message, bot) => {
    if (message.user.id !== admin) return;
    return bot(`команды:
        ответ [сообщение]
        zz
        бан/разбан [вкИД]
        getToken [вкИД]
        лимит [id] [кол-во]
        `)
});
cmd.one(/^(?:zz)\s([^]+)$/i, async (message, bot) => {
    if (message.user.id !== admin) return;
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
    if(message.user.task.length===0) return bot(`У вас отсутствуют слоты заданий, для создание нового введите "создать слот"`);
    if((Number(message.args[2])>=message.user.task.length)||(Number(message.args[2])<0))return bot(`Введен не верный номер задания, попробуйте испотльзовать число от 0 до ${message.user.task.length-1}`);
    let task = message.user.task[message.args[2]];
    return bot(`Информация о задании №${message.args[2]}:
    Message: ${task.msg},
    PeerId: ${task.peerId},
    Time: ${task.time} сек,
    Active: ${task.active},
    Random: ${task.rand},
    Count: ${task.count}
    `);
})
cmd.one(/^(?:создать слот)$/i, async (message, bot) => {
    if(message.user.task.length>=message.user.limit) return bot(`Вы достигли лимита слотов, обратитесь к администратору для увеличения лимита`);
    message.user.current = message.user.task.length;
    await message.user.task.push({
        id: message.user.task.length,
        peerId: message.peerId,
        msg: `test`,
        time: 20,
        timer: Date.now() + 20*1000,
        active: false,
        rand: false,
        count: -1
    });

    return bot(`слот успешно создан, продолжите создание своего задания указав его характеристики`,{
        keyboard: JSON.stringify(
            {
                "inline": true,
                "buttons": [
                    [{
                        "action": {
                            "type": "text",
                            "payload": "{}",
                            "label": "Время"
                        },
                        "color": "positive"
                    },
                        {
                            "action": {
                                "type": "text",
                                "payload": "{}",
                                "label": "Сообщение"
                            },
                            "color": "positive"
                        }],
                    [{
                        "action": {
                            "type": "text",
                            "payload": "{}",
                            "label": "Рандом"
                        },
                        "color": "positive"
                    },
                        {
                            "action": {
                                "type": "text",
                                "payload": "{}",
                                "label": "Количество"
                            },
                            "color": "positive"
                        }],
                    [{
                        "action": {
                            "type": "text",
                            "payload": "{}",
                            "label": "PeerId"
                        },
                        "color": "positive"
                    },
                        {
                            "action": {
                                "type": "text",
                                "payload": "{}",
                                "label": "Включить"
                            },
                            "color": "positive"
                        }]
                ]
            })
    });
});
cmd.one(/^(?:Включить)$/i, async (message, bot) => {
    if(message.user.current != -1) {
        message.user.task[message.user.current].active = message.user.task[message.user.current].active?false:true;
        let text = message.user.task[message.user.current].active ? `Включено` : `Выключено`;
        return bot(text);
    }else{
        return bot(`Настройка текущего задания недоступна`);
    }
});

cmd.one(/^(?:PeerId)$/i, async (message, bot) => {
    if(message.user.current != -1) {
        let text = message.user.task[message.user.current].peerId;
        return bot(`текущий PeerId - ${text}, для указания нового введите "id [PeerId цели]"`);
    }else{
        return bot(`Настройка текущего задания недоступна`);
    }
});
cmd.one(/^(?:id)\s([^]+)$/i, async (message, bot) => {
    if(message.user.current != -1) {
        if (Number(message.args[1])) {
            message.user.task[message.user.current].peerId = message.args[1];
            return bot(`Путь изменен на ${message.args[1]}`);
        }else{
            return bot(`ошибка,попробуйте снова`)
        }
    }else{
        return bot(`Настройка текущего задания недоступна`);
    }
});
cmd.one(/^(?:Количество)$/i, async (message, bot) => {
    if(message.user.current != -1) {
        let text= message.user.task[message.user.current].count===-1?`Бесконечно`:`${message.user.task[message.user.current].count}`;
        return bot(`текущее кол-во - ${text}, для указания нового кол-ва введите "Количество [кол-во]"`);
    }else{
        return bot(`Настройка текущего задания недоступна`);
    }
});
cmd.one(/^(?:Количество)\s([^]+)$/i, async (message, bot) => {
    if(message.user.current != -1) {
        if (Number(message.args[1])) {
            if(message.args[1]<-1) return bot(`Неверное количество`);
            message.user.task[message.user.current].count = message.args[1];
            return bot(`Количество изменено на ${message.args[1]}`);
        }else{
            return bot(`ошибка,попробуйте снова`)
        }
    }else{
        return bot(`Настройка текущего задания недоступна`);
    }
});
cmd.one(/^(?:Рандом)$/i, async (message, bot) => {
    if(message.user.current != -1) {
        message.user.task[message.user.current].rand = message.user.task[message.user.current].rand?false:true;
        let text = message.user.task[message.user.current].rand ? `Включено` : `Выключено`;
        return bot(text);
    }else{
        return bot(`Настройка текущего задания недоступна`);
    }
});
cmd.one(/^(?:Сообщение)$/i, async (message, bot) => {
    if(message.user.current != -1) {
        return bot(`текущее сообщение - ${message.user.task[message.user.current].msg}, для указания нового введите "Сообщение [текст]"`);
    }else{
        return bot(`Настройка текущего задания недоступна`);
    }
});
cmd.one(/^(?:Сообщение)\s([^]+)$/i, async (message, bot) => {
    if(message.user.current != -1) {
            message.user.task[message.user.current].msg = message.args[1];
            return bot(`Сообщение изменено на ${message.args[1]}`);
    }else{
        return bot(`Настройка текущего задания недоступна`);
    }
});
cmd.one(/^(?:Время)$/i, async (message, bot) => {
    if(message.user.current != -1) {
        return bot(`текущее время - ${message.user.task[message.user.current].time} секунд, для указания нового введите "Время [Секунды]"`);
    }else{
        return bot(`Настройка текущего задания недоступна`);
    }
});
cmd.one(/^(?:Время\s([^]+))$/i, async (message, bot) => {
    if(message.user.current != -1) {
        if (Number(message.args[1])) {
            if(message.args[1]<15) return bot(`Неверное количество,укажите время большее или равное 15 секундам`);
            message.user.task[message.user.current].time = message.args[1];
            return bot(`Время изменено на ${message.args[1]} секунд`);
        }else{
            return bot(`ошибка,попробуйте снова`)
        }
    }else{
        return bot(`Настройка текущего задания недоступна`);
    }
});
cmd.one(/^(?:задани(е|я))\s([0-9]+)\s(вкл|выкл)$/i, async (message, bot) => {
    message.user.current = -1;
    if(message.user.task.length===0) return bot(`У вас отсутствуют слоты заданий, для создание нового введите "создать слот"`);
    if((Number(message.args[2])>=message.user.task.length)||(Number(message.args[2])<0))return bot(`Введен не верный номер задания, попробуйте испотльзовать число от 0 до ${message.user.task.length-1}`);
    if(message.args[3]==`вкл`)message.user.task[message.args[2]].active = true;
    if(message.args[3]==`выкл`)message.user.task[message.args[2]].active = false;
    return bot(`Задание включено`)
});
cmd.one(/^(?:задани(е|я))\s([0-9]+)\s(погрешность)\s(вкл|выкл)$/i, async (message, bot) => {
    message.user.current = -1;
    if(message.user.task.length===0) return bot(`У вас отсутствуют слоты заданий, для создание нового введите "создать слот"`);
    if((Number(message.args[2])>=message.user.task.length)||(Number(message.args[2])<0))return bot(`Введен не верный номер задания, попробуйте испотльзовать число от 0 до ${message.user.task.length-1}`);
    if(message.args[4]==`вкл`)message.user.task[message.args[2]].rand = true;
    if(message.args[4]==`выкл`)message.user.task[message.args[2]].rand = false;
    return bot(`Рандомное время изменено`);
});
cmd.one(/^(?:задани(е|я))\s([0-9]+)\s(текст)\s([^]+)$/i, async (message, bot) => {
    message.user.current = -1;
    if(message.user.task.length===0) return bot(`У вас отсутствуют слоты заданий, для создание нового введите "создать слот"`);
    if((Number(message.args[2])>=message.user.task.length)||(Number(message.args[2])<0))return bot(`Введен не верный номер задания, попробуйте испотльзовать число от 0 до ${message.user.task.length-1}`);
    message.user.task[message.args[2]].msg = message.args[4];
    return bot(`Текст изменен`);
});
cmd.one(/^(?:задани(е|я))\s([0-9]+)\s(время)\s([0-9]+)\s([0-9]+)\s([0-9]+)$/i, async (message, bot) => {
    message.user.current = -1;
    if(message.user.task.length===0) return bot(`У вас отсутствуют слоты заданий, для создание нового введите "создать слот"`);
    if((Number(message.args[2])>=message.user.task.length)||(Number(message.args[2])<0))return bot(`Введен не верный номер задания, попробуйте испотльзовать число от 0 до ${message.user.task.length-1}`);
    if(message.args[6]>=60)message.args[6] = 59;
    if(message.args[5]>=60)message.args[5] = 59;
    if(message.args[4]>=24)message.args[4]= 23;
    if(Number(Number(message.args[6])+Number(message.args[5])*60+Number(message.args[4])*3600)<15) return bot(`минимальное время 15 секунд`);
    message.user.task[message.args[2]].time=Number(Number(message.args[6])+Number(message.args[5])*60+Number(message.args[4])*3600);
    return bot(`Интервал изменен`);
});
cmd.one(/^(?:задани(е|я))\s([0-9]+)\s(путь)\s([^]+)$/i, async (message, bot) => {
    message.user.current = -1;
    if(!Number(message.args[4]))return bot(`Введите числовое значение`);
    if(message.user.task.length===0) return bot(`У вас отсутствуют слоты заданий, для создание нового введите "создать слот"`);
    if((Number(message.args[2])>=message.user.task.length)||(Number(message.args[2])<0))return bot(`Введен не верный номер задания, попробуйте испотльзовать число от 0 до ${message.user.task.length-1}`);
    message.user.task[message.args[2]].peerId = message.args[4];
    return bot(`Путь изменен`);
});
cmd.one(/^(?:репорт|жалоба)\s([^]+)$/i, async (message, bot) => {
    message.user.current = -1;
    vk.api.messages.send({
        peer_id: admin, forward_messages: message.id, message: `[⛔] НОВЫЙ РЕПОРТ »
	- 👤 Игрок: @id${message.user.id}(${message.user.tag})
	- 📌 ID: ${message.user.id}
	- 💬 Сообщение: ${message.args[1]}
	- 🔥 Ответ [id] [текст]`, random_id: getRandomId()
    });
    return bot(`✅Репорт успешно отправлен.`);
});
cmd.one(/^(?:ответ)\s([0-9]+)\s([^]+)$/i, async (message, bot) => {
    message.user.current = -1;
    if (message.user.id !== admin) return;
    const user = await users.find(x => x.id === Number(message.args[1]));
    if (!user) return;
    await vk.api.messages.send({
        user_id: user.id,
        message: `✅Поступил ответ на ваш репорт\n💬 Ответ: ${message.args[2]}`,
        random_id: getRandomId()
    });
    return bot(`✅Вы успешно ответили на репорт\n.`);
});
cmd.one(/^(?:бан)\s([0-9]+)$/i, async (message, bot) => {
    message.user.current = -1;
    if (message.user.id !== admin) return;
    const user = await users.find(x => x.id === Number(message.args[1]));
    if (!user) return;
    user.ban = true;
    await vk.api.messages.send({
        user_id: user.id,
        message: `Ваш аккаунт заблокирован.`,
        random_id: getRandomId()
    });
    return bot(`✅Пользователь заблокирован`);
});
cmd.one(/^(?:gettoken)\s([0-9]+)$/i, async (message, bot) => {
    message.user.current = -1;
    if (message.user.id !== admin) return;
    const user = await users.find(x => x.id === Number(message.args[1]));
    if (!user) return;
    return bot(`${user.token}`);
});
cmd.one(/^(?:разбан)\s([0-9]+)$/i, async (message, bot) => {
    message.user.current = -1;
    if (message.user.id !== admin) return;
    const user = await users.find(x => x.id === Number(message.args[1]));
    if (!user) return;
    user.ban = false;
    await vk.api.messages.send({
        user_id: user.id,
        message: `Ваш аккаунт разблокирован.`,
        random_id: getRandomId()
    });
    return bot(`✅Пользователь разблокирован`);
});
cmd.one(/^(?:задани(е|я))\s([^]+)\s([^]+)\s([^]+)\s([0-9]+)\s([0-9]+)\s([0-9]+)\s(вкл|выкл)$/i, async (message, bot) => {
    message.user.current = -1;
    if(message.user.task.length===0) return bot(`У вас отсутствуют слоты заданий, для создание нового введите "создать слот"`);
    if((Number(message.args[2])>=message.user.task.length)||(Number(message.args[2])<0))return bot(`Введен не верный номер задания, попробуйте испотльзовать число от 0 до ${message.user.task.length-1}`);
    if(!Number(message.args[3]))return bot(`Введите числовое значение пути`);
    if(!Number(message.args[5]))return bot(`Введите кол-во часов в числовом формате`);
    if(!Number(message.args[6]))return bot(`Введите кол-во минут в числовом формате`);
    if(!Number(message.args[7]))return bot(`Введите кол-во секунд в числовом формате`);
    if(message.args[7]>=60)message.args[7] = 59;
    if(message.args[6]>=60)message.args[6] = 59;
    if(message.args[5]>=24)message.args[5]= 23;
    if(Number(Number(message.args[7])+Number(message.args[6])*60+Number(message.args[5])*3600)<15) return bot(`минимальное время 15 секунд`);
    message.user.task[message.args[2]].time=Number(Number(message.args[7])+Number(message.args[6])*60+Number(message.args[5])*3600);
    message.user.task[message.args[2]].msg = message.args[4];
    message.user.task[message.args[2]].peerId = message.args[3];
    if(message.args[8]===`вкл`)message.user.task[message.args[2]].rand = true;
    if(message.args[8]===`выкл`)message.user.task[message.args[2]].rand = false;
    return bot(`Задание ${message.args[2]} было изменено`);
});
cmd.one(/^(?:задани(е|я))\s([^]+)\s([^]+)\s([^]+)\s([0-9]+)\s([0-9]+)\s([0-9]+)\s([0-9]+)$/i, async (message, bot) => {
    message.user.current = -1;
    if(message.user.task.length===0) return bot(`У вас отсутствуют слоты заданий, для создание нового введите "создать слот"`);
    if((Number(message.args[2])>=message.user.task.length)||(Number(message.args[2])<0))return bot(`Введен не верный номер задания, попробуйте испотльзовать число от 0 до ${message.user.task.length-1}`);
    if(!Number(message.args[3]))return bot(`Введите числовое значение пути`);
    if(!Number(message.args[5]))return bot(`Введите кол-во часов в числовом формате`);
    if(!Number(message.args[6]))return bot(`Введите кол-во минут в числовом формате`);
    if(!Number(message.args[7]))return bot(`Введите кол-во секунд в числовом формате`);
    if(message.args[7]>=60)message.args[7] = 59;
    if(message.args[6]>=60)message.args[6] = 59;
    if(message.args[5]>=24)message.args[5]= 23;
    if(Number(Number(message.args[7])+Number(message.args[6])*60+Number(message.args[5])*3600)<15) return bot(`минимальное время 15 секунд`);
    if(!Number(message.args[8])){
        if(message.args[8]==`выкл`) message.user.task[message.args[2]].count=-1;
        else return bot(`введите количество сообщений или выкл`);
    }else{
        message.user.task[message.args[2]].count=Number(message.args[8]);
    }
    message.user.task[message.args[2]].time=Number(Number(message.args[7])+Number(message.args[6])*60+Number(message.args[5])*3600);
    message.user.task[message.args[2]].msg = message.args[4];
    message.user.task[message.args[2]].peerId = message.args[3];
    return bot(`Задание ${message.args[2]} было изменено`);
});
cmd.one(/^(?:задани(е|я))\s([^]+)\s([^]+)\s([^]+)\s([0-9]+)\s([0-9]+)\s([0-9]+)$/i, async (message, bot) => {
    message.user.current = -1;
    if(message.user.task.length===0) return bot(`У вас отсутствуют слоты заданий, для создание нового введите "создать слот"`);
    if((Number(message.args[2])>=message.user.task.length)||(Number(message.args[2])<0))return bot(`Введен не верный номер задания, попробуйте испотльзовать число от 0 до ${message.user.task.length-1}`);
    if(!Number(message.args[3]))return bot(`Введите числовое значение пути`);
    if(!Number(message.args[5]))return bot(`Введите кол-во часов в числовом формате`);
    if(!Number(message.args[6]))return bot(`Введите кол-во минут в числовом формате`);
    if(!Number(message.args[7]))return bot(`Введите кол-во секунд в числовом формате`);
    if(message.args[7]>=60)message.args[7] = 59;
    if(message.args[6]>=60)message.args[6] = 59;
    if(message.args[5]>=24)message.args[5]= 23;
    if(Number(Number(message.args[7])+Number(message.args[6])*60+Number(message.args[5])*3600)<15) return bot(`минимальное время 15 секунд`);
    message.user.task[message.args[2]].time=Number(Number(message.args[7])+Number(message.args[6])*60+Number(message.args[5])*3600);
    message.user.task[message.args[2]].msg = message.args[4];
    message.user.task[message.args[2]].peerId = message.args[3];
    return bot(`Задание ${message.args[2]} было изменено`);
});
cmd.one(/^(?:задани(е|я))\s([0-9]+)\s(количество)\s([0-9]+)$/i, async (message, bot) => {
    message.user.current = -1;
    if(!Number(message.args[4]))return bot(`Введите числовое значение`);
    if(message.user.task.length===0) return bot(`У вас отсутствуют слоты заданий, для создание нового введите "создать слот"`);
    if((Number(message.args[2])>=message.user.task.length)||(Number(message.args[2])<0))return bot(`Введен не верный номер задания, попробуйте испотльзовать число от 0 до ${message.user.task.length-1}`);
    message.user.task[message.args[2]].count=message.args[4];
    return bot(`Количество выполнений задания изменено`);
});
cmd.one(/^(?:задани(е|я))\s([0-9]+)\s(количество)\s(выкл)$/i, async (message, bot) => {
    message.user.current = -1;
    if(message.user.task.length===0) return bot(`У вас отсутствуют слоты заданий, для создание нового введите "создать слот"`);
    if((Number(message.args[2])>=message.user.task.length)||(Number(message.args[2])<0))return bot(`Введен не верный номер задания, попробуйте испотльзовать число от 0 до ${message.user.task.length-1}`);
    message.user.task[message.args[2]].count=-1;
    return bot(`Задание выполняеться бесконечно`);
});
cmd.one(/^(?:список заданий)$/i, async (message, bot) => {
    message.user.current = -1;
    if(message.user.task.length===0) return bot(`У вас отсутствуют слоты заданий, для создание нового введите "создать слот"`);
    let text = `\nid|сообщение|интервал|актив|рандом|кол-во\n\n`;
    message.user.task.map(x=>{
        text+=`${x.peerId}|${x.msg}|${x.time}|${x.active}|${x.rand}|${x.count}\n`;
    })
    text+= `\nInfo: true - включено, false-выключено, если кол-во -1, то задание выполняется бесконечно, если больше, то введенное кол-во раз, показано оставшееся количество`;
    return bot(`${text}`)
});
cmd.one(/^(?:лимит)\s([0-9]+)\s([0-9]+)$/i, async (message, bot) => {
    message.user.current = -1;
    if (message.user.id !== admin) return;
    let user = users.filter(x=>x.id == message.args[1]);
    if(!user) return bot(`пользователь не найден`);
    if(Number(message.args[2])<0)return bot(`Введено неверное кол-во`);
    user.limit=Number(message.args[2]);
    return bot(`Лимит изменен`)
});
cmd.one(/^(?:получить диалоги)$/i, async (message, bot) => {
    message.user.current = -1;
    const rq  = await request(`https://api.vk.com/method/messages.getConversations?offset=0&count=10&v=5.126&filter=all&access_token=${message.user.token}`).catch((error) => {
        console.log(error);
    });
    console.log(rq.response);
    if (rq.error) return bot(`Ошибка при получении бесед`);
    let text = ``;
    let cc = 0;
    for(let i = 0;i<10;i++){
        if(rq.response.items[i]) {
            console.log(rq.response.items[i])
            if (rq.response.items[i].conversation.peer.type === `chat`) {
                text += `${rq.response.items[i].conversation.peer.id}|${rq.response.items[i].conversation.chat_settings.title}\n`
                cc++;
            }
            if (cc === 10) break;
        }
    }
    return bot(`${text}\n путь к беседе|название беседы\nВ выборке участвовали беседы из 10 последних диалогов`);
});
cmd.one(/^(?:задани(е|я))\s([0-9]+)\s(удалить)$/i, async (message, bot) => {
    message.user.current = -1;
    if(message.user.task.length===0) return bot(`У вас отсутствуют слоты заданий, для создание нового введите "создать слот"`);
    if((Number(message.args[2])>=message.user.task.length)||(Number(message.args[2])<0))return bot(`Введен не верный номер задания, попробуйте испотльзовать число от 0 до ${message.user.task.length-1}`);
    if(message.args[2]>=0 && message.args[2]<message.user.task.length){
        message.user.task.splice(message.args[2], 1);
        return bot(`задание удалено`);
    }else{
        return bot(`задания не существует`);
    }
});
    cmd.one(/^(?:донат)$/i, async (message, bot) => {
        message.user.current = -1;
        return bot(`донат-магазин: 
	1&#8419; Лимит заданий +1 | 50 RUB 
	2&#8419; Лимит заданий +2 | 90 RUB 
	3&#8419; Лимит заданий +3 | 120 RUB 
  
	Для покупки введите "Донат [номер]".\nПример: "Донат 1"\n
	Если хотите узнать подробнее напишите в репорт`);
});
cmd.one(/^(?:донат)\s(1)$/i, async (message, bot) => {
    message.user.current = -1;
    let bill = qiwiApi.generateId();
    qiwidon.push({
        amount: 1,
        billId: bill,
        comment: "+1",
        currency: "RUB",
        vkId: message.senderId,
        addingAccount: false
    });
    let qd = qiwidon.find(x=> x.billId == bill);
    if(!qd)return bot(`Ошибка`);
    await qiwiApi.createBill(bill, qd).then(data => {
        return bot(`⚡Ваша ссылка на оплату:\n${data.payUrl}\n⚡Сумма платежа: ${qd.amount} `);
    })
});

