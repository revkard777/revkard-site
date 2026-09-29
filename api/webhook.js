// api/webhook.js
//
// Stripe chiama QUESTO indirizzo (non il browser del cliente) quando un
// pagamento va a buon fine. È l'unico punto in cui un ordine può dirsi
// davvero confermato: il semplice ritorno del browser sulla pagina di
// successo non è una prova di pagamento, perché chiunque potrebbe aprire
// quell'URL a mano senza aver pagato nulla.

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Necessario per verificare la firma: il corpo della richiesta deve arrivare
// "grezzo", non già interpretato come JSON.
export const config = { api: { bodyParser: false } };

async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Metoda niedozwolona');
  }

  let event;
  try {
    const buf = await buffer(req);
    const sig = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Firma webhook non valida:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    // Il pagamento è confermato. L'intero ordine (cliente, indirizzo di
    // spedizione, prodotti, importo) resta comunque sempre consultabile
    // in Stripe Dashboard → Pagamenti, quindi per iniziare non serve
    // nessun database separato.
    console.log(
      'Ordine REVKARD confermato:',
      session.id,
      session.customer_details && session.customer_details.email
    );

    // Se in futuro vuoi anche un'email di notifica o salvare l'ordine
    // altrove, è qui che va aggiunta quella chiamata.
  }

  return res.status(200).json({ received: true });
}
