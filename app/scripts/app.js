/**
 * REFERENCES
 * DOCS: https://developer.freshdesk.com/v2/docs
 * API: https://developers.freshdesk.com/api
 * https://developer.freshdesk.com/v2/docs/custom-apps/
 */

let client;

let call;

/** @type {{widgetURL: URL;}} **/
const setting = {};

const logName = 'brekeke-widget:freshdesk';
const logger = (...args) => {
  const { widgetURL } = setting;
  if (!widgetURL?.host.startsWith('localhost') && !widgetURL?.host.startsWith('127.0.0.1')) return;
  if (typeof args[0] === 'string' && args[0].includes('error')) {
    console.error(logName, ...args);
    return;
  }
  console.log(logName, ...args);
};

/** @type {Window} **/
let widgetWindow;

/** @type {string[]} **/
const calls = [];
let dialOut;
/** @type {import('../../../widget/src/types/phone').Call | undefined} */
let currentCall;
let agent;
let pbxAccount;

const messageName = name => `brekeke:${name}`;

const sendMessage = (name, data) => {
  if (!widgetWindow) return;
  try {
    widgetWindow.postMessage(JSON.stringify({ name: messageName(name), data }), '*');
  } catch (e) {
    logger('send message error', name, e);
  }
};

const messageHandlers = {
  [messageName('widgetReady')]: (_, ev) => {

    logger('widget ready');
    widgetWindow = ev.source;
    // client.instance.resize({ height: '500px' });

    sendMessage('config', {
      logButtonTitle: 'Create Ticket',
      logInputs: [
        {
          label: 'Subject',
          name: 'subject',
          type: 'text',
          required: true,
          defaultValue: `Call on #createdAt`,
        },
        {
          label: 'Description',
          name: 'description',
          type: 'textarea',
          required: true,
        },
        // {
        //   label: 'Status',
        //   name: 'status',
        //   type: 'select',
        //   defaultValue: 2,
        //   options: [
        //     { label: 'Open', value: 2 },
        //     { label: 'Pending', value: 3 },
        //     { label: 'Resolved', value: 4 },
        //     { label: 'Closed', value: 5 },
        //   ],
        // },
        // {
        //   label: 'Priority',
        //   name: 'priority',
        //   type: 'select',
        //   defaultValue: 1,
        //   options: [
        //     { label: 'Low', value: 1 },
        //     { label: 'Medium', value: 2 },
        //     { label: 'High', value: 3 },
        //     { label: 'Urgent', value: 4 },
        //   ],
        // },
      ],
    });
  },
  [messageName('logged-in')]: data => {
    pbxAccount = data;
    client.data.get('loggedInUser')
      .then(({ loggedInUser }) => {
        logger('loggedInUser', loggedInUser);
        if (loggedInUser) agent = loggedInUser;
      })
      .catch((error) => logger('loggedInUser error', error));
  },
  [messageName('logged-out')]: () => {
    currentCall = undefined;
    dialOut = undefined;
    agent = undefined;
    pbxAccount = undefined;
    calls.length = 0;
  },
  [messageName('call')]: data => {
    currentCall = data;
  },
  [messageName('call-updated')]: data => {
    const call = data;

    const callId = `${call.pbxRoomId}-${call.id}`;
    if (calls.includes(callId)) return;
    calls.push(callId);

    onCall(call);
  },
  [messageName('call-ended')]: data => void onCallEnded(data),
  [messageName('contact-selected')]: data => void onContactSelected(data),
  [messageName('log')]: data => void onLog(data),
};

window.addEventListener('messageerror', ev => logger('message error', ev));
window.addEventListener('message', ev => {
  try {
    const { name, data } = JSON.parse(ev.data);
    if (!name || (typeof name == 'string' && !name.startsWith('brekeke:'))) return;

    logger(`${name} message received`, ev);
    logger(`${name} message data`, data);

    messageHandlers[name](data, ev);
  } catch (e) {
    logger('message error, invalid json string', e);
  }
});

document.addEventListener('readystatechange', e => {
  logger('readystatechange', document.readyState, { app: window.app ?? null }, e);
  if (document.readyState !== 'complete') return;
  void init();
});

const openWidget = () => client.interface.trigger('show', { id: 'softphone' });
const openContact = id => client.interface.trigger('click', { id: 'contact', value: id });
const openTicket = id => client.interface.trigger('click', { id: 'ticket', value: id });

const mapContact = ({ id, name }) => ({ id, name });

async function init() {
  logger('init', document.readyState);
  client = await app.initialized();
  client.events.on('app.activated', onAppActivate);
}

let activated = false;

async function onAppActivate() {
  if (activated) return;
  activated = true;
  client.instance.resize({ height: '500px' });
  logger('onAppActivate');

  // const { widgetUrl } = client.context.settings;
  const { widgetUrl } = await client.iparams.get('widgetUrl');
  setting.widgetURL = new URL(widgetUrl);
  logger('widgetURL', { widgetUrl });

  // logger('settings', client.context.settings);

  // client.iparams.get().then(iparams => logger('iparams', iparams));

  document.getElementById('widget-container').src = widgetUrl;

  // Click to call
  client.events.on('cti.triggerDialer', event => {
    openWidget();
    const data = event.helper.getData();
    sendMessage('make-call', data.number);
    const message = `Clicked phone number: ${data.number}`;
    logger('cti.triggerDialer', message, { event, data });

    // client.interface.trigger('showNotify', { type: 'success', message });
  });
}

const onCall = (call) => {
  openWidget();

  const phone = call.partyNumber;

  client.request.invokeTemplate('findContacts', { context: { phone } })
    .then(data => {
      logger('findContacts', JSON.parse(data.response), data);
      const { results, total } = JSON.parse(data.response);

      if (total > 0) {
        const contact = results[0];
        logger(contact);

        sendMessage('call-info', {
          call,
          info: results.map(mapContact),
        });

        openContact(contact.id);
      } else {
        const newContact = {
          name: `Caller ${phone}`,
          phone,
        };

        client.request.invokeTemplate('createContact', { body: JSON.stringify(newContact) })
          .then((data) => {
            logger('create user', data);

            if (data.status === 201) {
              const contact = JSON.parse(data.response);

              sendMessage('call-info', {
                call,
                info: mapContact(contact),
              });

              openContact(contact.id);
            }
          })
          .catch((err) => logger('create user error', err));
      }
    })
    .catch(e => {
      logger('findContacts error', e);
      const response = JSON.parse(e.response);
      if (response.message) {
        sendMessage('notification', { message: response.message, type: 'error' });
      }
    });
};

const onCallEnded = (call) => {
  if (call.pbxRoomId === currentCall?.pbxRoomId) {
    currentCall = undefined;
  }

  if (dialOut?.number === call.partyNumber) {
    dialOut = undefined;
  }
};

const onContactSelected = ({ call, contact }) => {
  logger('onContactSelected', { call, contact });
  openContact(contact.id);
};

const onLog = (log) => {
  logger('logEvent', log);

  if (!log.contactId) {
    sendMessage('notification', {
      type: 'error',
      message: 'This call was not associated with a contact.',
    });
    return;
  }

  let { subject, description } = log.inputs;

  if (log.recording) {
    const { url } = log.recording;
    description += `<br><audio preload="none" controls style="height: 32px"><source src="${url}" />This browser does not support audios</audio>`;
  }

  const newTicket = {
    responder_id: agent.id, // agent id
    requester_id: log.contactId,
    subject,
    description, // html
    // description_text: log.description,
    source: 3, // phone
    status: Number('2'),
    priority: Number('1'),
  };

  client.request.invokeTemplate('createTicket', { body: JSON.stringify(newTicket) })
    .then((data) => {
      logger('create ticket', data);
      if (data.status === 201) {
        const ticket = JSON.parse(data.response);
        sendMessage('log-saved', log);
        openTicket(ticket.id);
      } else {
        sendMessage('log-failed', log);
      }
    })
    .catch((error) => {
      sendMessage('log-failed', log);
      logger('ticket error', error);
    });
};
