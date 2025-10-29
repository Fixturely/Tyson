import { CustomerBillingInfoModel } from '../customer_billing_info';

// Mock the database
jest.mock('../../services/database', () => {
  const mockRaw = jest.fn();
  const mockQueryBuilder = {
    insert: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(null),
    onConflict: jest.fn().mockReturnThis(),
    merge: jest.fn().mockResolvedValue(1),
    ignore: jest.fn().mockResolvedValue(1),
    raw: mockRaw,
  } as any;

  const mockDb = jest.fn(() => mockQueryBuilder) as any;
  (mockDb as any).raw = mockRaw;

  return {
    __esModule: true,
    default: mockDb,
  };
});

// Mock logger
jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('CustomerBillingInfoModel', () => {
  let model: CustomerBillingInfoModel;
  let mockDb: any;
  let qb: any;

  const stripeCustomer: any = {
    id: 'cus_123',
    email: 'user@example.com',
    name: 'Jane Doe',
    address: {
      line1: '123 Main St',
      line2: null,
      city: 'Metropolis',
      state: 'NY',
      postal_code: '10001',
      country: 'US',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    model = new CustomerBillingInfoModel();
    mockDb = require('../../services/database').default;
    qb = mockDb('customer_billing_info');
  });

  it('createCustomerBillingInfo should insert a record', async () => {
    await model.createCustomerBillingInfo({
      customer_id: 'cus_123',
      email: 'user@example.com',
    });

    expect(mockDb).toHaveBeenCalledWith('customer_billing_info');
    expect(qb.insert).toHaveBeenCalledWith({
      customer_id: 'cus_123',
      email: 'user@example.com',
    });
  });

  it('ensureExistsFromStripe should insert and ignore on conflict', async () => {
    await model.ensureExistsFromStripe(stripeCustomer);

    expect(qb.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        customer_id: 'cus_123',
        email: 'user@example.com',
      })
    );
    expect(qb.onConflict).toHaveBeenCalledWith('customer_id');
    expect(qb.ignore).toHaveBeenCalled();
  });

  it('updateFromStripe should upsert and merge fields', async () => {
    await model.updateFromStripe(stripeCustomer);

    expect(qb.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        customer_id: 'cus_123',
        email: 'user@example.com',
        name: 'Jane Doe',
      })
    );
    expect(qb.onConflict).toHaveBeenCalledWith('customer_id');
    expect(qb.merge).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'user@example.com',
        name: 'Jane Doe',
        city: 'Metropolis',
      })
    );
  });

  it('getCustomerBillingInfoByCustomerId should return a record', async () => {
    qb.first.mockResolvedValueOnce({
      customer_id: 'cus_123',
      email: 'user@example.com',
    });

    const rec = await model.getCustomerBillingInfoByCustomerId('cus_123');
    expect(mockDb).toHaveBeenCalledWith('customer_billing_info');
    expect(qb.where).toHaveBeenCalledWith('customer_id', 'cus_123');
    expect(rec).toEqual({ customer_id: 'cus_123', email: 'user@example.com' });
  });
});
