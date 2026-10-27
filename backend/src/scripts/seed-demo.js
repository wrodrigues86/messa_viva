import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { db } from '../database/index.js';

const slug = 'cantina-da-massa-demo';
const restaurantName = 'Cantina da Massa';
const dishes = [
  { name: 'Spaghetti à Carbonara', description: 'Spaghetti envolvido em molho cremoso de gemas e pecorino, com pancetta crocante e pimenta-do-reino.', price: 39.9, featured: true },
  { name: 'Fettuccine Alfredo', description: 'Fettuccine na manteiga com creme de leite fresco e parmesão ralado na hora.', price: 37.9 },
  { name: 'Lasanha à Bolonhesa', description: 'Camadas de massa fresca, ragu de carne cozido lentamente, molho bechamel e muçarela.', price: 42.9, featured: true },
  { name: 'Nhoque de Batata ao Sugo', description: 'Nhoque artesanal de batata servido com molho de tomate da casa e folhas de manjericão.', price: 36.9 },
  { name: 'Penne ao Pesto', description: 'Penne com pesto de manjericão, castanha-de-caju e parmesão.', price: 38.9 },
  { name: 'Talharim com Ragu de Costela', description: 'Talharim fresco acompanhado de costela bovina desfiada e cozida lentamente no molho de tomate.', price: 46.9 },
  { name: 'Ravioli de Ricota e Espinafre', description: 'Ravioli artesanal recheado com ricota e espinafre, servido com molho de manteiga e sálvia.', price: 41.9 },
  { name: 'Fusilli Quatro Queijos', description: 'Fusilli ao molho de gorgonzola, parmesão, provolone e muçarela.', price: 40.9 },
  { name: 'Parafuso com Frango ao Molho Branco', description: 'Massa parafuso com cubos de frango grelhado e molho branco leve.', price: 37.9 },
  { name: 'Spaghetti de Frutos do Mar', description: 'Spaghetti salteado com camarões, lula, tomate e ervas frescas.', price: 52.9 },
];

const seed = db.transaction(() => {
  let restaurant = db.prepare('SELECT id FROM establishments WHERE slug = ?').get(slug);
  if (!restaurant) {
    const id = randomUUID();
    db.prepare(`
      INSERT INTO establishments (id, slug, name, description, address, phone, primary_color, accent_color, published)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(id, slug, restaurantName, 'Massas artesanais preparadas com ingredientes frescos.', 'Rua das Oliveiras, 120', '(11) 4000-1234', '#176b52', '#e7a83e');
    restaurant = { id };
  }
  db.prepare('UPDATE establishments SET published = 1 WHERE id = ?').run(restaurant.id);

  let category = db.prepare('SELECT id FROM categories WHERE establishment_id = ? AND name = ?').get(restaurant.id, 'Massas');
  if (!category) {
    const id = randomUUID();
    db.prepare('INSERT INTO categories (id, establishment_id, name, description, sort_order, active) VALUES (?, ?, ?, ?, 0, 1)')
      .run(id, restaurant.id, 'Massas', 'Receitas italianas preparadas na casa.');
    category = { id };
  }
  db.prepare('UPDATE categories SET active = 1 WHERE id = ?').run(category.id);

  const findDish = db.prepare('SELECT id FROM products WHERE establishment_id = ? AND name = ?');
  const insertDish = db.prepare(`
    INSERT INTO products (id, establishment_id, category_id, name, description, price, promotional_price, available, featured, image_url)
    VALUES (?, ?, ?, ?, ?, ?, NULL, 1, ?, '')
  `);
  const updateDish = db.prepare(`
    UPDATE products SET category_id = ?, description = ?, price = ?, promotional_price = NULL,
      available = 1, featured = ?, image_url = '' WHERE id = ? AND establishment_id = ?
  `);

  let created = 0;
  let updated = 0;
  for (const dish of dishes) {
    const existing = findDish.get(restaurant.id, dish.name);
    if (existing) {
      updateDish.run(category.id, dish.description, dish.price, dish.featured ? 1 : 0, existing.id, restaurant.id);
      updated += 1;
    } else {
      insertDish.run(randomUUID(), restaurant.id, category.id, dish.name, dish.description, dish.price, dish.featured ? 1 : 0);
      created += 1;
    }
  }
  return { created, updated };
});

try {
  const result = seed();
  console.log(`Cardápio de demonstração pronto: http://localhost:5173/m/${slug}`);
  console.log(`${result.created} pratos criados; ${result.updated} pratos atualizados.`);
} finally {
  db.close();
}
