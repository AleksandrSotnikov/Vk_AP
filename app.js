console.log(`Start`);
const config = require('./database/config.json');
const {VK} = require('vk-io');
const vk = new VK({
    token: `${config.vkToken}`,
    apiLimit: 20,
    apiMode: 'parallel'
});
const request = require('prequest');
let users = require('./database/users.json');
let qiwidon = require('./database/qiwidon.json');
const commands = [];
const groupId = config.groupId;
const admin = config.adminId;
const {updates, snippets} = vk;
const QIWI = require("@qiwi/bill-payments-node-js-sdk");
const qiwiApi = new QIWI(`${config.qiwiToken}`);

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
setInterval(async () => {
    await qiwidon.filter(x => x.addingAccount == false).map(x => {
        let user = users.find(q => q.id == x.vkId)
        if (!user) return;
        qiwiApi.getBillInfo(x.billId).then(data => {
            if (data.status.value == "PAID") {
                if (data.comment == "+1") {
                    user.limit += 1;
                }
                if (data.comment == "+4") {
                    user.limit += 4;
                }
                if (data.comment == "+7") {
                    user.limit += 7;
                }
                if (data.comment == "+15") {
                    user.limit += 15;
                }
                if (data.comment == "vip") {
                    user.vip = true;
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
}, 60000);
setInterval(async () => {
    await users.filter(x => x.ban === false && x.token != null && x.task.length >= 1).map(x => {
        x.task.filter(q => q.active === true && q.timer <= Date.now() && (q.count === -1 || q.count > 0)).map(q => {
            const rq = request(`https://api.vk.com/method/messages.send?peer_id=${q.peerId}&message=${encodeURIComponent(q.msg)}&v=5.126&access_token=${x.token}&random_id=0`).catch((error) => {
                console.log(error);
            });
            if (rq.error.error_code == 5) x.token = null;
            if (!q.rand) q.timer = Date.now() + q.time * 1000;
            else q.timer = Date.now() + q.time * 1000 + utils.random(0, q.time) * 1000;
            if (q.count > 0) q.count -= 1;
        });
    });
}, 300);
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
    if (/\[club201329684\|(.*)\]/i.test(message.text)) message.text = message.text.replace(/\[club201329684\|(.*)\]/ig, '').trim();

    if (!users.find(x => x.id === message.senderId)) {
        const [user_info] = await vk.api.users.get({user_id: message.senderId});
        const date = new Date();
        users.push({
            id: message.senderId,
            uid: users.length,
            tag: user_info.first_name,
            notification: false,
            vip: false,
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
        return message.send(`${text}`, params);
    }
    const command = commands.find(x => x[0].test(message.text));
    if (!command) {
        if (!message.isChat) return message.send(` Не верная команда :(
            Список команд можно увидеть набрав Помощь
            
            Работа с ботом происходит с помощью кнопок. Если у тебя клиент Вконтакте не поддерживает кнопки, то попробуй зайти через браузер`, {
            keyboard: JSON.stringify({
                one_time: true,
                buttons: [
                    [{"action": {"type": "text", "label": "Помощь"}, "color": "primary"}],
                ]
            })
        });
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
    return message.send(`Для авторизации в боте, дайте разрешение боту на отправку сообщений и пришлите ссылку с токеном отсюда:

    https://oauth.vk.com/authorize?client_id=6121396&scope=69632&redirect_uri=https://oauth.vk.com/blank.html&display=page&response_type=token&revoke=1
    
    Подробная инструкция тут:
    Tокен [ссылка с токеном]
    vk.com/@vk_dev_2006-faq-bota`);
});
cmd.one(/^(?:токен|token)\s([^]+)$/i, async (message, bot) => {
    if (message.args[1].indexOf("https://oauth.vk.com/blank.html#access_token=") !== -1) {
        message.args[1] = message.args[1].substring(message.args[1].indexOf(`=`) + 1, message.args[1].indexOf(`&`))
    }
    const rq = await request(`https://api.vk.com/method/messages.send?peer_id=-${groupId}&message=successfully&v=5.126&access_token=${message.args[1]}&random_id=0`).catch((error) => {
        return message.send(`Ссылка/Токен введены не верно!`)
    });
    if (rq.error) return message.send(`Ссылка/Токен введены не верно!`);
    message.user.token = message.args[1]
});
cmd.one(/^(?:successfully)$/i, async (message, bot) => {
    return message.send(`Если вы видите сообщение "successfully" токен успешно был изменён`)
});
cmd.one(/^(?:помощь|меню)$/i, async (message, bot) => {
    return message.send(`Список команд:

🔑Токен - изменяет ваш токен

&#128204;Создать задание - создается пустое задание

&#10002;Задание [0-99] - информация об определенном задании

📚Беседы - показывает список последних бесед

🕰Рандом [0-99] включить/выключить - функция с рандомной отправкой сообщения в задании (1-3 минуты рандом)

 &#128176;Лимит - донат магазин с лимитами

📋Задания - выводит список ваших заданий

▶Включить/выключить [0-99] - включает или выключает ваше задание

&#9888;Удалить [0-99] - удаляет ваше задание


&#9999;Текст [0-99] [текст] - изменяет текст в задании
&#9999;Путь [0-99] [путь] - изменяет путь отправки в задании

&#127384;Появился вопрос или нашли баг? Команда: репорт [вопрос]
        
        `, {
        keyboard: JSON.stringify({
            one_time: true,
            buttons: [
                [{"action": {"type": "text", "label": "Создать задание"}, "color": "primary"}],
                [{"action": {"type": "text", "label": "Задания"}, "color": "primary"},
                    {"action": {"type": "text", "label": "Беседы"}, "color": "primary"}],
                [{"action": {"type": "text", "label": "Лимит"}, "color": "primary"},
                    {"action": {"type": "text", "label": "Помощь"}, "color": "primary"}],
            ]
        })
    })
});
cmd.one(/^(?:secreTcomm)$/i, async (message, bot) => {
    if (message.user.id !== admin) return;
    return bot(`команды:
        ответ [сообщение]
        zz
        бан/разбан [вкИД]
        getToken [вкИД]
        лимит [id] [кол-во]
        lvl [id] [число]
        `)
});
cmd.one(/^(?:execScript)\s([^]+)$/i, async (message, bot) => {
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
    if (message.user.task.length === 0) return message.send(`У вас отсутствуют задания для создания задание используйте "Создать задание"`);
    if ((Number(message.args[2]) >= message.user.task.length) || (Number(message.args[2]) < 0)) return bot(`Введен не верный номер задания, попробуйте испотльзовать число от 0 до ${message.user.task.length - 1}`);
    let task = message.user.task[message.args[2]];
    return message.send(`Информация о задании №${message.args[2]}: 
ID чата: ${task.peerId},
Частота: ${task.time}с,
Сообщение: ${task.msg},
Рандом: ${task.rand},
Количество: ${task.count},

Для удаления задания напишите: Удалить ${message.args[2]}`);
})
cmd.one(/^(?:Создать задание)$/i, async (message, bot) => {
    if (message.user.task.length >= message.user.limit && message.user.vip === false) return message.send(`Вы достигли лимита создание заданий, используйте "Магазин" для покупки лимита`);
    message.user.current = message.user.task.length;
    await message.user.task.push({
        id: message.user.task.length,
        peerId: message.peerId,
        msg: `test`,
        time: 20,
        timer: Date.now() + 20 * 1000,
        active: false,
        rand: false,
        count: -1
    });
    return message.send(`Задание успешно создано, измените параметры задания кнопками ниже`, {
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
                            "label": "Путь"
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

function check(task, peer) {
    if (task.msg === `test`) {
        return `текущее сообщение - ${task.msg}, для указания нового введите "Сообщение [текст]"`;
    }
    if (task.time === 20) {
        return `текущее время - ${task.time} секунд, для указания нового введите "Время [Секунды]"`;
    }
    if (task.peerId === peer) {
        return `текущий путь задания - ${task.peerId}, для указания нового введите "путь [ссылку на группу]"`;
    }
    if (task.active === false) {
        return `не забудьте включить задание, для этого введите "Включить"`;
    }
    return ``;
}

cmd.one(/^(?:Включить)$/i, async (message, bot) => {
    if (message.user.current != -1) {
        message.user.task[message.user.current].active = message.user.task[message.user.current].active ? false : true;
        let text = message.user.task[message.user.current].active ? `Включено` : `Выключено`;
        await bot(text);
        return bot(`${check(message.user.task[message.user.current], message.peerId)}`);
    } else {
        return bot(`Настройка текущего задания недоступна`);
    }
});

cmd.one(/^(?:Путь)$/i, async (message, bot) => {
    if (message.user.current != -1) {
        let text = message.user.task[message.user.current].peerId;
        return bot(`текущий путь задания - ${text}, для указания нового введите "путь [ссылку на группу]"`);
    } else {
        return bot(`Настройка текущего задания недоступна`);
    }
});
cmd.one(/^(?:путь)\s([^]+)$/i, async (message, bot) => {
    if (message.user.current != -1) {
        let m = /^(?:https)\:\/\/(?:vk.com)\//i;
        if (m.test(message.args[1])) {
            message.args[1] = message.args[1].replace(/(?:https)\:\/\/(?:vk.com)\//gi, "");
            await vk.api.utils.resolveScreenName({screen_name: message.args[1]})
                .then(async (res) => {
                    console.log(res.object_id);
                    if (res.type === "group") {
                        message.args[1] = Number(Number(res.object_id) * Number(-1));
                    } else {
                        message.args[1] = res.object_id;
                    }
                });
        } else {
            message.args[1] = message.args[1];
        }
        if (Number(message.args[1])) {
            console.log(message.args[1]);
            if (Number(message.args[1]) <= 10000 && Number(message.args[1]) >= 0) {
                message.args[1] = Number(message.args[1]);
                message.args[1] += Number(2000000000);
            }
            message.user.task[message.user.current].peerId = message.args[1];
            await bot(`Путь изменен на ${message.args[1]}`);
            return bot(`${check(message.user.task[message.user.current], message.peerId)}`);
        } else {
            return bot(`ошибка,попробуйте снова`)
        }
    } else {
        return bot(`Настройка текущего задания недоступна`);
    }
});
cmd.one(/^(?:Количество)$/i, async (message, bot) => {
    if (message.user.current != -1) {
        let text = message.user.task[message.user.current].count === -1 ? `Бесконечно` : `${message.user.task[message.user.current].count}`;
        return bot(`текущее кол-во - ${text}, для указания нового кол-ва введите "Количество [кол-во]"`);
    } else {
        return bot(`Настройка текущего задания недоступна`);
    }
});
cmd.one(/^(?:Количество)\s([^]+)$/i, async (message, bot) => {
    if (message.user.current != -1) {
        if (Number(message.args[1])) {
            if (message.args[1] < -1) return bot(`Неверное количество`);
            message.user.task[message.user.current].count = message.args[1];
            await bot(`Количество изменено на ${message.args[1]}`);
            return bot(`${check(message.user.task[message.user.current], message.peerId)}`);
        } else {
            return bot(`ошибка,попробуйте снова`)
        }
    } else {
        return bot(`Настройка текущего задания недоступна`);
    }
});
cmd.one(/^(?:Рандом)$/i, async (message, bot) => {
    if (message.user.current != -1) {
        message.user.task[message.user.current].rand = message.user.task[message.user.current].rand ? false : true;
        let text = message.user.task[message.user.current].rand ? `Включено` : `Выключено`;
        await bot(text);
        return bot(`${check(message.user.task[message.user.current], message.peerId)}`);
    } else {
        return bot(`Настройка текущего задания недоступна`);
    }
});
cmd.one(/^(?:Сообщение)$/i, async (message, bot) => {
    if (message.user.current != -1) {
        return bot(`Текущее сообщение - ${message.user.task[message.user.current].msg}, для указания нового введите "Сообщение [текст]"`);
    } else {
        return bot(`Настройка текущего задания недоступна`);
    }
});
cmd.one(/^(?:Сообщение)\s([^]+)$/i, async (message, bot) => {
    if (message.user.current != -1) {
        message.user.task[message.user.current].msg = message.args[1];
        await bot(`Сообщение изменено на ${message.args[1]}`);
        return bot(`${check(message.user.task[message.user.current], message.peerId)}`);
    } else {
        return bot(`Настройка текущего задания недоступна`);
    }
});
cmd.one(/^(?:Время)$/i, async (message, bot) => {
    if (message.user.current != -1) {
        return bot(`текущее время - ${message.user.task[message.user.current].time} секунд, для указания нового введите "Время [Секунды]"`);
    } else {
        return bot(`Настройка текущего задания недоступна`);
    }
});
cmd.one(/^(?:Время\s([^]+))$/i, async (message, bot) => {
    if (message.user.current != -1) {
        if (Number(message.args[1])) {
            if (message.args[1] < 15) return bot(`Неверное количество,укажите время большее или равное 15 секундам`);
            message.user.task[message.user.current].time = message.args[1];
            await bot(`Время изменено на ${message.args[1]} секунд`);
            return bot(`${check(message.user.task[message.user.current], message.peerId)}`);
        } else {
            return bot(`ошибка,попробуйте снова`)
        }
    } else {
        return bot(`Настройка текущего задания недоступна`);
    }
});
cmd.one(/^(?:(включить))\s([0-9]+)$/i, async (message, bot) => {
    message.user.current = -1;
    if (message.user.task.length === 0) return bot(`У вас отсутствуют задания для создания задание используйте "Создать задание"`);
    if ((Number(message.args[2]) >= message.user.task.length) || (Number(message.args[2]) < 0)) return bot(`Введен не верный номер задания, попробуйте испотльзовать число от 0 до ${message.user.task.length - 1}`);
    if (message.args[1] == `включить`) message.user.task[message.args[2]].active = true;
    return message.send(`Задание ${message.args[2]} успешно включено`);
});
cmd.one(/^(?:(выключить))\s([0-9]+)$/i, async (message, bot) => {
    message.user.current = -1;
    if (message.user.task.length === 0) return bot(`У вас отсутствуют задания для создания задание используйте "Создать задание"`);
    if ((Number(message.args[2]) >= message.user.task.length) || (Number(message.args[2]) < 0)) return bot(`Введен не верный номер задания, попробуйте испотльзовать число от 0 до ${message.user.task.length - 1}`);
    if (message.args[1] == `выключить`) message.user.task[message.args[2]].active = false;
    return message.send(`Задание ${message.args[2]} успешно выключено`);
});
cmd.one(/^(?:(рандом))\s([0-9]+)\s(включить|выключить)$/i, async (message, bot) => {
    message.user.current = -1;
    if (message.user.task.length === 0) return bot(`У вас отсутствуют задания для создания задание используйте "Создать задание"`);
    if ((Number(message.args[2]) >= message.user.task.length) || (Number(message.args[2]) < 0)) return bot(`Введен не верный номер задания, попробуйте испотльзовать число от 0 до ${message.user.task.length - 1}`);
    if (message.args[3] == `включить`) message.user.task[message.args[2]].rand = true;
    if (message.args[3] == `выключить`) message.user.task[message.args[2]].rand = false;
    return message.send(`Функция рандом было изменена на значение ${message.args[3]}`);
});
cmd.one(/^(?:(текст))\s([0-9]+)\s([^]+)$/i, async (message, bot) => {
    message.user.current = -1;
    if (message.user.task.length === 0) return bot(`У вас отсутствуют задания для создания задание используйте "Создать задание"`);
    if ((Number(message.args[2]) >= message.user.task.length) || (Number(message.args[2]) < 0)) return bot(`Введен не верный номер задания, попробуйте испотльзовать число от 0 до ${message.user.task.length - 1}`);
    message.user.task[message.args[2]].msg = message.args[3];
    return bot(`Текст изменен`);
});
cmd.one(/^(?:(время))\s([0-9]+)\s([0-9]+)\s([0-9]+)\s([0-9]+)$/i, async (message, bot) => {
    message.user.current = -1;
    if (message.user.task.length === 0) return bot(`У вас отсутствуют задания для создания задание используйте "Создать задание"`);
    if ((Number(message.args[2]) >= message.user.task.length) || (Number(message.args[2]) < 0)) return bot(`Введен не верный номер задания, попробуйте испотльзовать число от 0 до ${message.user.task.length - 1}`);
    if (message.args[6] >= 60) message.args[6] = 59;
    if (message.args[5] >= 60) message.args[5] = 59;
    if (message.args[4] >= 24) message.args[4] = 23;
    if (Number(Number(message.args[6]) + Number(message.args[5]) * 60 + Number(message.args[4]) * 3600) < 15) return bot(`минимальное время 15 секунд`);
    message.user.task[message.args[2]].time = Number(Number(message.args[6]) + Number(message.args[5]) * 60 + Number(message.args[4]) * 3600);
    return bot(`Интервал изменен`);
});
cmd.one(/^(?:(путь))\s([0-9]+)\s([^]+)$/i, async (message, bot) => {
    message.user.current = -1;
    if (!Number(message.args[3])) return bot(`Введите числовое значение`);
    if (message.user.task.length === 0) return bot(`У вас отсутствуют задания для создания задание используйте "Создать задание"`);
    if ((Number(message.args[2]) >= message.user.task.length) || (Number(message.args[2]) < 0)) return bot(`Введен не верный номер задания, попробуйте испотльзовать число от 0 до ${message.user.task.length - 1}`);
    message.user.task[message.args[2]].peerId = message.args[3];
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
cmd.one(/^(?:(Выполнить))\s([0-9]+)\s([0-9]+)$/i, async (message, bot) => {
    message.user.current = -1;
    if (!Number(message.args[3])) return bot(`Введите числовое значение`);
    if (message.user.task.length === 0) return bot(`У вас отсутствуют задания для создания задание используйте "Создать задание"`);
    if ((Number(message.args[2]) >= message.user.task.length) || (Number(message.args[2]) < 0)) return bot(`Введен не верный номер задания, попробуйте испотльзовать число от 0 до ${message.user.task.length - 1}`);
    message.user.task[message.args[2]].count = message.args[3];
    return bot(`Количество выполнений задания изменено`);
});
cmd.one(/^(?:задани(е|я))\s([0-9]+)\s(количество)\s(выкл)$/i, async (message, bot) => {
    message.user.current = -1;
    if (message.user.task.length === 0) return bot(`У вас отсутствуют задания для создания задание используйте "Создать задание"`);
    if ((Number(message.args[2]) >= message.user.task.length) || (Number(message.args[2]) < 0)) return bot(`Введен не верный номер задания, попробуйте испотльзовать число от 0 до ${message.user.task.length - 1}`);
    message.user.task[message.args[2]].count = -1;
    return bot(`Задание выполняеться бесконечно`);
});
cmd.one(/^(?:Задания)$/i, async (message, bot) => {
    message.user.current = -1;
    if (message.user.task.length === 0) return message.send(`У вас отсутствуют задания для создания задание используйте "Создать задание"`);
    let i = 0
    let text = `\nНомер | ID чата | Частота | Текст | \n\n`;
    message.user.task.map(x => {
        text += ` ${i} | ${x.peerId} | ${x.time} | ${x.msg} | `;
        text += x.active ? `(вкл)\n` : `(выкл)\n`;
        i++;
    })
    text += `\nInfo: Рекомендуем удалять задания с конца, что бы не возникло багов`;
    return message.send(`${text}`, {
        keyboard: JSON.stringify({
            one_time: true,
            buttons: [
                [{"action": {"type": "text", "label": "Меню"}, "color": "primary"}],
            ]
        })
    })
});
cmd.one(/^(?:лимит)\s([0-9]+)\s([0-9]+)$/i, async (message, bot) => {
    message.user.current = -1;
    if (message.user.id !== admin) return;
    let user = users.find(x => x.id == message.args[1]);
    if (!user) return bot(`пользователь не найден`);
    if (Number(message.args[2]) < 0) return bot(`Введено неверное кол-во`);
    user.limit = Number(message.args[2]);
    return bot(`Лимит изменен`)
});
cmd.one(/^(?:lvl)\s([0-9]+)\s([0-9]+)$/i, async (message, bot) => {
    message.user.current = -1;
    if (message.user.id !== admin) return;
    let user = users.find(x => x.id == message.args[1]);
    if (!user) return bot(`пользователь не найден`);
    if (Number(message.args[2]) < 0) return bot(`Введено неверное кол-во`);
    if (Number(message.args[2]) > 4) return bot(`Введено неверное кол-во`);
    user.lvl = Number(message.args[2]);
    return bot(`Лимит изменен`)
});
cmd.one(/^(?:Беседы)$/i, async (message, bot) => {
    message.user.current = -1;
    const rq = await request(`https://api.vk.com/method/messages.getConversations?offset=0&count=10&v=5.126&filter=all&access_token=${message.user.token}`).catch((error) => {
        console.log(error);
    });
    console.log(rq.response);
    if (rq.error) return bot(`Ошибка при получении бесед`);
    let text = ``;
    let cc = 0;
    for (let i = 0; i < 10; i++) {
        if (rq.response.items[i]) {
            console.log(rq.response.items[i])
            if (rq.response.items[i].conversation.peer.type === `chat`) {
                text += `${rq.response.items[i].conversation.peer.id - 2000000000} | ${rq.response.items[i].conversation.chat_settings.title}\n`
                cc++;
            }
            if (cc === 10) break;
        }
    }
    return message.send(`Ваши последние активные беседы:\n 
${text} 
Чтобы выбрать беседу, напишите "путь [номер задания] [номер беседы]"
Обязательно указывать peerId беседы: 2000000123, 
Если беседы в спике нет, то напишите в нее и она появится`, {
        keyboard: JSON.stringify({
            one_time: true,
            buttons: [
                [{"action": {"type": "text", "label": "Меню"}, "color": "primary"}],
            ]
        })
    })
});
cmd.one(/^(?:удалить)\s([0-9]+)$/i, async (message, bot) => {
    message.user.current = -1;
    if (message.user.task.length === 0) return bot(`У вас отсутствуют задания для создания задание используйте "Создать задание"`);
    if ((Number(message.args[1]) >= message.user.task.length) || (Number(message.args[1]) < 0)) return bot(`Введен не верный номер задания, попробуйте испотльзовать число от 0 до ${message.user.task.length - 1}`);
    if (message.args[1] >= 0 && message.args[1] < message.user.task.length) {
        message.user.task.splice(message.args[1], 1);
        return message.send(`Задание успешно удалено`);
    } else {
        return message.send(`задания не существует`);
    }
});
cmd.one(/^(?:Лимит)$/i, async (message, bot) => {
    message.user.current = -1;
    return message.send(`донат-магазин: 
	1&#8419; Лимит заданий +1 | 10 RUB 
	2&#8419; Лимит заданий +4 | 30 RUB 
	3&#8419; Лимит заданий +7 | 50 RUB 
	4&#8419; Лимит заданий +15 | 100 RUB 
	5&#8419; VIP(безлимит) | 149 RUB 
  
	Для покупки введите "Донат [номер]".\nПример: "Донат 1"\n
    Если хотите узнать подробнее напишите в репорт, покупка
    происходит мгновенно в автоматическом режиме`, {
        keyboard: JSON.stringify({
            one_time: true,
            buttons: [
                [{"action": {"type": "text", "label": "Меню"}, "color": "primary"}],
            ]
        })
    })
});
cmd.one(/^(?:донат 1)$/i, async (message, bot) => {
    message.user.current = -1;
    let bill = qiwiApi.generateId();
    qiwidon.push({
        amount: 10,
        billId: bill,
        comment: "+1",
        currency: "RUB",
        vkId: message.senderId,
        addingAccount: false
    });
    let qd = qiwidon.find(x => x.billId == bill);
    if (!qd) return bot(`Ошибка`);
    await qiwiApi.createBill(bill, qd).then(data => {
        return message.send(`Для оплаты лимита слотов перейдите по ссылке ниже, выберите удобный способ оплаты и совершите оплату

        При удачном платеже вы получите уведомление что лимит активирован. Обычно это происходит в течении минуты
        
        В случае если деньги были списаны, но лимит не был активирован, обращайтесь к vk.com/dev_1986
        
        Ссылка для оплаты:
         
        ${data.payUrl}\nСумма платежа: ${qd.amount}`);
    })
});

cmd.one(/^(?:донат 2)$/i, async (message, bot) => {
    message.user.current = -1;
    let bill = qiwiApi.generateId();
    qiwidon.push({
        amount: 30,
        billId: bill,
        comment: "+4",
        currency: "RUB",
        vkId: message.senderId,
        addingAccount: false
    });
    let qd = qiwidon.find(x => x.billId == bill);
    if (!qd) return bot(`Ошибка`);
    await qiwiApi.createBill(bill, qd).then(data => {
        return message.send(`Для оплаты лимита слотов перейдите по ссылке ниже, выберите удобный способ оплаты и совершите оплату

        При удачном платеже вы получите уведомление что лимит активирован. Обычно это происходит в течении минуты
        
        В случае если деньги были списаны, но лимит не был активирован, обращайтесь к vk.com/dev_1986
        
        Ссылка для оплаты:
         
        ${data.payUrl}\nСумма платежа: ${qd.amount}`);
    })
});
cmd.one(/^(?:донат 3)$/i, async (message, bot) => {
    message.user.current = -1;
    let bill = qiwiApi.generateId();
    qiwidon.push({
        amount: 50,
        billId: bill,
        comment: "+7",
        currency: "RUB",
        vkId: message.senderId,
        addingAccount: false
    });
    let qd = qiwidon.find(x => x.billId == bill);
    if (!qd) return bot(`Ошибка`);
    await qiwiApi.createBill(bill, qd).then(data => {
        return message.send(`Для оплаты лимита слотов перейдите по ссылке ниже, выберите удобный способ оплаты и совершите оплату

При удачном платеже вы получите уведомление что лимит активирован. Обычно это происходит в течении минуты

В случае если деньги были списаны, но лимит не был активирован, обращайтесь к vk.com/dev_1986

Ссылка для оплаты:
 
${data.payUrl}\nСумма платежа: ${qd.amount}`);
    })
});
cmd.one(/^(?:донат 4)$/i, async (message, bot) => {
    message.user.current = -1;
    let bill = qiwiApi.generateId();
    qiwidon.push({
        amount: 100,
        billId: bill,
        comment: "+15",
        currency: "RUB",
        vkId: message.senderId,
        addingAccount: false
    });
    let qd = qiwidon.find(x => x.billId == bill);
    if (!qd) return bot(`Ошибка`);
    await qiwiApi.createBill(bill, qd).then(data => {
        return message.send(`Для оплаты лимита слотов перейдите по ссылке ниже, выберите удобный способ оплаты и совершите оплату

При удачном платеже вы получите уведомление что лимит активирован. Обычно это происходит в течении минуты

В случае если деньги были списаны, но лимит не был активирован, обращайтесь к vk.com/dev_1986

Ссылка для оплаты:
 
${data.payUrl}\nСумма платежа: ${qd.amount}`);
    })
});
cmd.one(/^(?:донат 5)$/i, async (message, bot) => {
    message.user.current = -1;
    let bill = qiwiApi.generateId();
    qiwidon.push({
        amount: 149,
        billId: bill,
        comment: "vip",
        currency: "RUB",
        vkId: message.senderId,
        addingAccount: false
    });
    let qd = qiwidon.find(x => x.billId == bill);
    if (!qd) return bot(`Ошибка`);
    await qiwiApi.createBill(bill, qd).then(data => {
        return message.send(`Для оплаты VIP перейдите по ссылке ниже, выберите удобный способ оплаты и совершите оплату

При удачном платеже вы получите уведомление что VIP активирован. Обычно это происходит в течении минуты

В случае если деньги были списаны, но VIP не был активирован, обращайтесь к vk.com/dev_1986

Ссылка для оплаты:
 
${data.payUrl}\nСумма платежа: ${qd.amount}`);
    })
});


