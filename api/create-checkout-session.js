// api/create-checkout-session.js
//
// Riceve dal sito solo gli ID e le quantità dei prodotti nel carrello.
// I PREZZI VERI sono definiti qui sotto, sul server: il browser non può
// modificarli in alcun modo. Crea una sessione di pagamento Stripe Checkout
// e restituisce l'URL a cui il sito deve reindirizzare il cliente.

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Prezzi ufficiali REVKARD, in grosze (1 zł = 100 grosze).
// Per cambiare un prezzo in futuro, modifica SOLO questi numeri.
const PRODUCTS = {
  one:      { name: 'REVKARD ONE — 1 karta NFC',      amount: 9999 },
  duo:      { name: 'REVKARD DUO — 2 karty NFC',       amount: 17999 },
  business: { name: 'REVKARD BUSINESS — 5 kart NFC',   amount: 34999 },
};

// Paesi verso cui accetti la spedizione (codici ISO a due lettere).
// Aggiungine o toglierne quanti vuoi.
const SHIPPING_COUNTRIES = ['PL','DE','CZ','SK','LT','FR','IT','ES','NL','BE','AT','GB','IE'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Metoda niedozwolona' });
  }

  try {
    const { items } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Koszyk jest pusty' });
    }

    const line_items = items.map((it) => {
      const p = PRODUCTS[it && it.id];
      if (!p) throw new Error('unknown_product');
      const qty = Math.min(Math.max(parseInt(it.qty, 10) || 0, 1), 20);
      return {
        quantity: qty,
        price_data: {
          currency: 'pln',
          unit_amount: p.amount,
          product_data: { name: p.name },
        },
      };
    });

    const site = process.env.PUBLIC_SITE_URL;
    if (!site) throw new Error('missing_PUBLIC_SITE_URL');

    // payment_method_types NON è impostato di proposito: così Stripe mostra
    // automaticamente i metodi che hai attivato nel Dashboard (carta, BLIK,
    // Przelewy24, Apple Pay, Google Pay) — è la modalità "dynamic payment
    // methods", quella consigliata da Stripe oggi.
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      shipping_address_collection: { allowed_countries: SHIPPING_COUNTRIES },
      phone_number_collection: { enabled: true },
      custom_fields: [
        {
          key: 'company',
          label: { type: 'custom', custom: 'Firma (opcjonalnie)' },
          type: 'text',
          optional: true,
        },
      ],
      success_url: `${site}/?checkout=success`,
      cancel_url: `${site}/?checkout=cancel`,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('create-checkout-session:', err);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
}
