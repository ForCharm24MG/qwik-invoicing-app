import {
  component$,
  useStore,
  $,
  useSignal,
  useTask$,
} from '@builder.io/qwik';
import type { DocumentHead } from '@builder.io/qwik-city';
import { routeLoader$, routeAction$, Form, z, zod$ } from '@builder.io/qwik-city';
import db from '~/lib/db';

// --- TYPE DEFINITIONS ---
export interface Customer { id: number; name: string; phone: string; email: string | null; address: string | null; }
export interface Product { id: number; name: string; description: string | null; price: number; tax: number; }
export interface InvoiceItem extends Product { quantity: number; }
export interface Invoice { id: number; customerId: number; createdAt: string; totalAmount: number; customerName: string; items: InvoiceItem[] }

// --- SERVER-SIDE DATA LOADERS (Fetch data on the server) ---
export const useCustomersLoader = routeLoader$(() => db.prepare('SELECT * FROM customers ORDER BY name').all() as Customer[]);
export const useProductsLoader = routeLoader$(() => db.prepare('SELECT * FROM products ORDER BY name').all() as Product[]);

export const useInvoicesLoader = routeLoader$(() => {
  const invoices = db.prepare(`
    SELECT i.id, i.customerId, i.createdAt, i.totalAmount, c.name as customerName
    FROM invoices i JOIN customers c ON i.customerId = c.id
    ORDER BY i.createdAt DESC
  `).all() as Omit<Invoice, 'items'>[];

  const itemsStmt = db.prepare(`
    SELECT p.name, p.description, ii.quantity, ii.priceAtSale as price, ii.taxAtSale as tax
    FROM invoice_items ii JOIN products p ON ii.productId = p.id
    WHERE ii.invoiceId = ?
  `);

  return invoices.map(invoice => ({
    ...invoice,
    items: itemsStmt.all(invoice.id) as InvoiceItem[],
  })) as Invoice[];
});

// --- SERVER-SIDE ACTIONS (Handle form submissions on the server) ---
export const useAddCustomerAction = routeAction$((data) => {
    db.prepare('INSERT INTO customers (name, phone, email, address) VALUES (?, ?, ?, ?)').run(data.name, data.phone, data.email, data.address);
}, zod$({ name: z.string().min(1), phone: z.string().min(1), email: z.string().email().optional().or(z.literal('')), address: z.string().optional() }));

export const useAddProductAction = routeAction$((data) => {
    db.prepare('INSERT INTO products (name, description, price, tax) VALUES (?, ?, ?, ?)').run(data.name, data.description, data.price, data.tax);
}, zod$({ name: z.string().min(1), description: z.string().optional(), price: z.coerce.number().min(0), tax: z.coerce.number().min(0) }));

export const useCreateInvoiceAction = routeAction$((data) => {
  const items: InvoiceItem[] = JSON.parse(data.itemsJSON);
  const totalAmount = items.reduce((acc, item) => {
    const itemTotal = item.price * item.quantity;
    const taxAmount = itemTotal * (item.tax / 100);
    return acc + itemTotal + taxAmount;
  }, 0);

  // Use a transaction: all steps must succeed or none do. This prevents partial invoices.
  const transaction = db.transaction(() => {
    const invoiceStmt = db.prepare('INSERT INTO invoices (customerId, createdAt, totalAmount) VALUES (?, ?, ?)');
    const result = invoiceStmt.run(data.customerId, new Date().toISOString(), totalAmount);
    const invoiceId = result.lastInsertRowid;

    const itemStmt = db.prepare('INSERT INTO invoice_items (invoiceId, productId, quantity, priceAtSale, taxAtSale) VALUES (?, ?, ?, ?, ?)');
    for (const item of items) {
      itemStmt.run(invoiceId, item.id, item.quantity, item.price, item.tax);
    }
  });
  
  try {
    transaction();
    return { success: true };
  } catch (error) {
    console.error("Invoice creation failed:", error);
    return { success: false, error: "Failed to save invoice." };
  }
}, zod$({ customerId: z.coerce.number(), itemsJSON: z.string().min(1) }));

// --- MAIN PAGE COMPONENT ---
export default component$(() => {
  const customers = useCustomersLoader();
  const products = useProductsLoader();
  const invoices = useInvoicesLoader();
  const addCustomerAction = useAddCustomerAction();
  const addProductAction = useAddProductAction();
  const createInvoiceAction = useCreateInvoiceAction();
  
  const activeTab = useSignal<'customers' | 'products' | 'invoices'>('invoices');
  const invoiceView = useSignal<'create' | 'history'>('create');
  const notification = useStore({ message: '', type: '', visible: false });
  const invoiceState = useStore<{ customer: Customer | null; items: InvoiceItem[] }>({ customer: null, items: [] });

  // This task watches for a successful invoice creation and resets the form.
  useTask$(({ track }) => {
    track(() => createInvoiceAction.value);

    if (createInvoiceAction.value?.success) {
      invoiceState.customer = null;
      invoiceState.items = [];
      invoiceView.value = 'history';
      showNotification('Invoice saved successfully!', 'success');
    }
  });

  const showNotification = $((message: string, type: 'success' | 'error') => {
      notification.message = message;
      notification.type = type;
      notification.visible = true;
      setTimeout(() => { notification.visible = false }, 3000);
  });

  const selectCustomer = $((customer: Customer) => {
    invoiceState.customer = customer;
    activeTab.value = 'products';
    showNotification(`Customer "${customer.name}" selected.`, 'success');
  });

  const addToInvoice = $((product: Product) => {
    const existingItem = invoiceState.items.find(item => item.id === product.id);
    if (existingItem) existingItem.quantity++;
    else invoiceState.items.push({ ...product, quantity: 1 });
    showNotification(`Added "${product.name}" to invoice.`, 'success');
  });
  
  const clearInvoiceState = $(() => {
    invoiceState.customer = null;
    invoiceState.items = [];
    activeTab.value = 'customers';
  });
  
  return (
    <div class="container">
      <header><h1>Qwik Invoicing System</h1><p>Full-Stack with SQLite Database</p></header>
      <div class="tabs">
        <div class={['tab', { active: activeTab.value === 'customers' }]} onClick$={() => (activeTab.value = 'customers')}>Customers</div>
        <div class={['tab', { active: activeTab.value === 'products' }]} onClick$={() => (activeTab.value = 'products')}>Products</div>
        <div class={['tab', { active: activeTab.value === 'invoices' }]} onClick$={() => (activeTab.value = 'invoices')}>Invoices</div>
      </div>
      {notification.visible && <div class={`notification ${notification.type}`}>{notification.message}</div>}

      {activeTab.value === 'customers' && <CustomerManagement customers={customers.value} addCustomerAction={addCustomerAction} onCustomerSelect={selectCustomer}/>}
      {activeTab.value === 'products' && <ProductManagement products={products.value} addProductAction={addProductAction} onAddToInvoice={addToInvoice}/>}
      {activeTab.value === 'invoices' && (
        <div class="content-section active">
          <div class="sub-tabs">
            <button class={{ active: invoiceView.value === 'create' }} onClick$={() => invoiceView.value = 'create'}>Create New Invoice</button>
            <button class={{ active: invoiceView.value === 'history' }} onClick$={() => invoiceView.value = 'history'}>Invoice History</button>
          </div>
          {invoiceView.value === 'create' ? (
            <InvoiceCreation invoiceState={invoiceState} createInvoiceAction={createInvoiceAction} onClearCustomer={clearInvoiceState}/>
          ) : (
            <InvoiceHistory invoices={invoices.value} />
          )}
        </div>
      )}
    </div>
  );
});

// --- CHILD COMPONENTS ---

export const CustomerManagement = component$<{ customers: Customer[]; addCustomerAction: any; onCustomerSelect: any }>(({ customers, addCustomerAction, onCustomerSelect }) => {
    const searchPhone = useSignal('');
    const foundCustomer = useSignal<Customer | null | 'not_found'>(null);
    return (
        <div class="content-section active">
            <h2>Customer Management</h2>
            <div class="form-group">
                <label>Find Customer by Phone:</label>
                <div style="display: flex;">
                    <input type="text" placeholder="Enter phone number" bind:value={searchPhone} />
                    <button onClick$={() => {
                        const cust = customers.find(c => c.phone === searchPhone.value);
                        foundCustomer.value = cust ? cust : 'not_found';
                    }} style="margin-left: 10px;">Find</button>
                </div>
            </div>
            {foundCustomer.value && <div class="customer-info" style={{ marginTop: '15px' }}>
                {foundCustomer.value === 'not_found' ? <p>No customer found.</p> : <>
                    <h3>Customer Found</h3>
                    <p><strong>Name:</strong> {foundCustomer.value.name}</p>
                    <button onClick$={() => onCustomerSelect(foundCustomer.value as Customer)}>Select this Customer</button>
                </>}
            </div>}
            <h3>Add New Customer</h3>
            <Form action={addCustomerAction} class="form-group">
                <label>Full Name:</label> <input name="name" required />
                <label>Phone Number:</label> <input name="phone" required />
                <label>Email:</label> <input name="email" type="email" />
                <label>Address:</label> <input name="address" />
                <button type="submit">Add Customer</button>
            </Form>
        </div>
    );
});

export const ProductManagement = component$<{ products: Product[]; addProductAction: any; onAddToInvoice: any }>(({ products, addProductAction, onAddToInvoice }) => (
    <div class="content-section active">
        <h2>Product Management</h2>
        <h3>Add New Product</h3>
        <Form action={addProductAction} class="form-group">
            <label>Product Name:</label> <input name="name" required />
            <label>Description:</label> <input name="description" />
            <label>Price (₹):</label> <input name="price" type="number" step="0.01" required />
            <label>GST Rate (%):</label> <input name="tax" type="number" step="0.1" required />
            <button type="submit">Add Product</button>
        </Form>
        <h3>Product List</h3>
        <table>
            <thead><tr><th>Name</th><th>Price</th><th>Tax</th><th>Action</th></tr></thead>
            <tbody>{products.map(p => (<tr key={p.id}>
                <td>{p.name}</td>
                <td>${p.price.toFixed(2)}</td>
                <td>{p.tax}%</td>
                <td><button onClick$={() => onAddToInvoice(p)}>Add to Invoice</button></td>
            </tr>))}</tbody>
        </table>
    </div>
));

export const InvoiceCreation = component$<{ invoiceState: any; createInvoiceAction: any; onClearCustomer: any }>(({ invoiceState, createInvoiceAction, onClearCustomer }) => {
    const subtotal = invoiceState.items.reduce((acc: number, item: InvoiceItem) => acc + item.price * item.quantity, 0);
    const totalTax = invoiceState.items.reduce((acc: number, item: InvoiceItem) => acc + (item.price * item.quantity * (item.tax / 100)), 0);
    return <>
        <h2>Create Invoice</h2>
        {invoiceState.customer ? <div class="customer-info">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3>Customer Information</h3>
                <button onClick$={onClearCustomer} class="danger">Change Customer</button>
            </div>
            <p><strong>Name:</strong> {invoiceState.customer.name}</p>
            <p><strong>Phone:</strong> {invoiceState.customer.phone || 'N/A'}</p>
            <p><strong>Email:</strong> {invoiceState.customer.email || 'N/A'}</p>
            <p><strong>Address:</strong> {invoiceState.customer.address || 'N/A'}</p>
        </div> : <div class="customer-info"><p>Please select a customer from the 'Customers' tab first.</p></div>}
        
        <h3>Invoice Items</h3>
        <table>
            <thead><tr><th>Product</th><th>Quantity</th><th>Price</th><th>Tax</th><th>Total</th><th>Action</th></tr></thead>
            <tbody>{invoiceState.items.map((item: InvoiceItem) => {
                const itemTotal = item.price * item.quantity;
                const itemTax = itemTotal * (item.tax / 100);
                return (<tr key={item.id}>
                    <td>{item.name}</td>
                    <td><input type="number" value={item.quantity} min="1" style="width: 60px;" 
                        onInput$={(e) => {
                            const found = invoiceState.items.find((i: InvoiceItem) => i.id === item.id);
                            if(found) found.quantity = parseInt((e.target as HTMLInputElement).value, 10);
                        }}/>
                    </td>
                    <td>${item.price.toFixed(2)}</td><td>{item.tax}%</td>
                    <td>${(itemTotal + itemTax).toFixed(2)}</td>
                    <td><button onClick$={() => invoiceState.items = invoiceState.items.filter((i: InvoiceItem) => i.id !== item.id)} class="danger">Remove</button></td>
                </tr>)
            })}</tbody>
        </table>

        {invoiceState.items.length > 0 && <div class="invoice-summary">
            <div class="summary-row"><span>Subtotal:</span> <span>${subtotal.toFixed(2)}</span></div>
            <div class="summary-row"><span>Tax:</span> <span>${totalTax.toFixed(2)}</span></div>
            <div class="summary-row total"><span>Total:</span> <span>${(subtotal + totalTax).toFixed(2)}</span></div>
        </div>}
        
        <Form action={createInvoiceAction} class="actions">
            <input type="hidden" name="customerId" value={invoiceState.customer?.id} />
            <input type="hidden" name="itemsJSON" value={JSON.stringify(invoiceState.items)} />
            <button type="submit" disabled={!invoiceState.customer || invoiceState.items.length === 0}>Save Invoice</button>
        </Form>
    </>;
});

export const InvoiceHistory = component$<{ invoices: Invoice[] }>(({ invoices }) => {
    const selectedInvoice = useSignal<Invoice | null>(null);
    return <>
        <h2>Invoice History</h2>
        {selectedInvoice.value ? (<>
            <button onClick$={() => selectedInvoice.value = null}>← Back to List</button>
            <div class="invoice-detail">
                <h3>Invoice #{selectedInvoice.value.id}</h3>
                <p><strong>Customer:</strong> {selectedInvoice.value.customerName}</p>
                <p><strong>Date:</strong> {new Date(selectedInvoice.value.createdAt).toLocaleDateString()}</p>
                <h4>Items</h4>
                <table>
                    <thead><tr><th>Product</th><th>Qty</th><th>Price</th><th>Tax</th><th>Total</th></tr></thead>
                    <tbody>{selectedInvoice.value.items.map(item => {
                        const itemTotal = item.price * item.quantity;
                        const itemTax = itemTotal * (item.tax / 100);
                        return (<tr key={item.name}>
                            <td>{item.name}</td><td>{item.quantity}</td><td>${item.price.toFixed(2)}</td><td>{item.tax}%</td>
                            <td>${(itemTotal + itemTax).toFixed(2)}</td>
                        </tr>)
                    })}</tbody>
                </table>
                <div class="invoice-summary">
                    <div class="summary-row total"><span>Grand Total:</span> <span>${selectedInvoice.value.totalAmount.toFixed(2)}</span></div>
                </div>
            </div>
        </>) : (<>
            <table>
                <thead><tr><th>Invoice ID</th><th>Customer</th><th>Date</th><th>Total</th><th>Action</th></tr></thead>
                <tbody>{invoices.map(inv => (<tr key={inv.id}>
                    <td>#{inv.id}</td>
                    <td>{inv.customerName}</td>
                    <td>{new Date(inv.createdAt).toLocaleDateString()}</td>
                    <td>${inv.totalAmount.toFixed(2)}</td>
                    <td><button onClick$={() => selectedInvoice.value = inv}>View Details</button></td>
                </tr>))}</tbody>
            </table>
            {invoices.length === 0 && <p>No invoices have been created yet.</p>}
        </>)}
    </>;
});


// --- STYLES & HEAD ---
export const head: DocumentHead = {
  title: 'Qwik Invoicing System',
  styles: [{ style: `
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: Arial, sans-serif; }
    body { background-color: #f5f5f5; padding: 20px; line-height: 1.6; color: #333; }
    .container { max-width: 1000px; margin: 0 auto; background: white; padding: 20px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
    header { text-align: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #ddd; }
    h1 { color: #2c3e50; margin-bottom: 10px; }
    .tabs { display: flex; margin-bottom: 20px; border-bottom: 1px solid #ddd; }
    .tab { padding: 10px 20px; cursor: pointer; background: #f0f0f0; border: 1px solid #ddd; border-bottom: none; margin-right: 5px; border-top-left-radius: 5px; border-top-right-radius: 5px; }
    .tab.active { background: white; border-bottom: 1px solid white; margin-bottom: -1px; font-weight: bold; }
    .content-section { padding: 20px; border: 1px solid #ddd; border-top: none; }
    .sub-tabs { margin-bottom: 20px; }
    .sub-tabs button { background: #e9ecef; border: 1px solid #dee2e6; }
    .sub-tabs button.active { background: #3498db; color: white; border-color: #3498db; }
    .form-group { margin-bottom: 15px; }
    label { display: block; margin-bottom: 5px; font-weight: bold; }
    input, select { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 10px; }
    button { padding: 10px 15px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 10px; }
    button:hover { background: #2980b9; }
    button:disabled { background: #bdc3c7; cursor: not-allowed; }
    button.danger { background: #e74c3c; }
    button.danger:hover { background: #c0392b; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f0f0f0; }
    .actions { margin-top: 20px; display: flex; justify-content: flex-end; }
    .customer-info, .invoice-summary, .invoice-detail { background: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
    .summary-row { display: flex; justify-content: space-between; padding: 5px 0; }
    .total { font-weight: bold; border-top: 1px solid #ddd; padding-top: 10px; }
    .notification { padding: 10px; border-radius: 4px; margin-bottom: 15px; }
    .notification.success { background: #d4edda; color: #155724; }
    .notification.error { background: #f8d7da; color: #721c24; }
  `}],
};
