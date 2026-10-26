import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { toIsoDateInZone } from '../src/common/clock.js';
import type { Config } from '../src/config/index.js';
import { setupApp } from '../src/setup-app.js';
import { resetDatabase } from './reset-database.js';

/**
 * Runs the API against the real SQL Server of docker-compose.yml, after
 * resetting it with database/init.sql. Covers the business rules end to end.
 */

let today: string;

function inDays(days: number): string {
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

describe('Transport planning API (e2e)', () => {
  let app: INestApplication<App>;

  const as = (user: 'diane' | 'eric') => ({
    get: (url: string) =>
      request(app.getHttpServer()).get(url).set('X-User-Id', user),
    post: (url: string, body?: object) =>
      request(app.getHttpServer()).post(url).set('X-User-Id', user).send(body),
    delete: (url: string) =>
      request(app.getHttpServer()).delete(url).set('X-User-Id', user),
  });
  const diane = () => as('diane');
  const eric = () => as('eric');

  const salesOrderStatus = async (no: string): Promise<string | undefined> => {
    const response = await diane().get('/sales-orders/to-plan?pageSize=100');
    const toPlan = (response.body as { items: { no: string }[] }).items;
    return toPlan.some((item) => item.no === no) ? 'TO_PLAN' : undefined;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const config = moduleRef.get<ConfigService<Config, true>>(ConfigService);
    today = toIsoDateInZone(
      new Date(),
      config.get('app.timezone', { infer: true }),
    );
    await resetDatabase(config.get('db', { infer: true }));
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('current user', () => {
    it('rejects a request without X-User-Id with 401', async () => {
      const response = await request(app.getHttpServer()).get('/vehicles');
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({ code: 'UNKNOWN_USER' });
    });

    it('rejects an unknown user with 401', async () => {
      const response = await request(app.getHttpServer())
        .get('/vehicles')
        .set('X-User-Id', 'mallory');
      expect(response.status).toBe(401);
    });

    it('lists users and roles without authentication', async () => {
      const response = await request(app.getHttpServer()).get('/users');
      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        { id: 'diane', role: 'DISPATCHER' },
        { id: 'eric', role: 'LOGISTICS_MANAGER' },
      ]);
    });
  });

  describe('reference data', () => {
    it('lists only active vehicles, in camelCase', async () => {
      const response = await diane().get('/vehicles');
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(9);
      expect(response.body[0]).toEqual({
        code: 'VH-01',
        plateNo: 'LT-482-AB',
        capacityKg: 1500,
        active: true,
      });
      expect(response.body.map((v: { code: string }) => v.code)).not.toContain(
        'VH-07',
      );
    });

    it('lists sales orders to plan, filtered by city and paginated', async () => {
      const response = await diane().get(
        '/sales-orders/to-plan?city=Kribi&page=1&pageSize=3',
      );
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ total: 4, page: 1, pageSize: 3 });
      expect(response.body.items).toHaveLength(3);
      expect(response.body.items[0]).toEqual({
        no: 'SO-1009',
        customerNo: 'C0008',
        customerName: 'Hôtel Kribi Plage',
        deliveryCity: 'Kribi',
        totalWeightKg: 380,
        status: 'TO_PLAN',
      });

      const page2 = await diane().get(
        '/sales-orders/to-plan?city=Kribi&page=2&pageSize=3',
      );
      expect(page2.body.items).toHaveLength(1);
    });

    it('rejects invalid pagination with 400', async () => {
      const response = await diane().get('/sales-orders/to-plan?pageSize=0');
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('reading transport orders', () => {
    it('filters by status', async () => {
      const response = await diane().get('/transport-orders?status=DRAFT');
      expect(response.status).toBe(200);
      expect(response.body.items.map((o: { no: string }) => o.no)).toEqual([
        'TO-0004',
        'TO-0003',
      ]);
    });

    it('filters by delivery date', async () => {
      const response = await diane().get(
        `/transport-orders?deliveryDate=${inDays(1)}`,
      );
      expect(response.body.items.map((o: { no: string }) => o.no)).toEqual([
        'TO-0003',
        'TO-0002',
      ]);
    });

    it('returns the detail with sales orders and total weight', async () => {
      const response = await diane().get('/transport-orders/TO-0003');
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        no: 'TO-0003',
        vehicleCode: 'VH-01',
        vehicleCapacityKg: 1500,
        deliveryDate: inDays(1),
        status: 'DRAFT',
        createdBy: 'diane',
        validatedBy: null,
        salesOrderCount: 2,
        totalWeightKg: 1360,
      });
      expect(response.body.version).toMatch(/^[0-9a-f]{16}$/);
      expect(
        response.body.salesOrders.map((s: { no: string }) => s.no),
      ).toEqual(['SO-1006', 'SO-1007']);
    });

    it('returns 404 for an unknown order', async () => {
      const response = await diane().get('/transport-orders/TO-9999');
      expect(response.status).toBe(404);
      expect(response.body.code).toBe('TRANSPORT_ORDER_NOT_FOUND');
    });
  });

  describe('creation rules', () => {
    it.each([
      [
        'a date in the past',
        () => ({ vehicleCode: 'VH-05', deliveryDate: inDays(-1) }),
        422,
        'DELIVERY_DATE_IN_PAST',
      ],
      [
        'an inactive vehicle',
        () => ({ vehicleCode: 'VH-07', deliveryDate: inDays(3) }),
        422,
        'VEHICLE_INACTIVE',
      ],
      [
        'an unknown vehicle',
        () => ({ vehicleCode: 'VH-99', deliveryDate: inDays(3) }),
        422,
        'VEHICLE_NOT_FOUND',
      ],
      [
        'a vehicle already booked that day',
        () => ({ vehicleCode: 'VH-01', deliveryDate: inDays(1) }),
        409,
        'VEHICLE_ALREADY_BOOKED',
      ],
      [
        'a malformed date',
        () => ({ vehicleCode: 'VH-05', deliveryDate: '2026-02-30' }),
        400,
        'VALIDATION_ERROR',
      ],
    ])('refuses %s', async (_label, body, status, code) => {
      const response = await diane().post('/transport-orders', body());
      expect(response.status).toBe(status);
      expect(response.body.code).toBe(code);
    });

    it('creates only one order when the same slot is requested twice at once', async () => {
      const body = { vehicleCode: 'VH-10', deliveryDate: inDays(7) };
      const responses = await Promise.all([
        diane().post('/transport-orders', body),
        eric().post('/transport-orders', body),
      ]);
      expect(responses.map((r) => r.status).sort((a, b) => a - b)).toEqual([
        201, 409,
      ]);
    });
  });

  describe('full lifecycle', () => {
    let no: string;
    let version: string;

    it('creates a draft order', async () => {
      const response = await diane().post('/transport-orders', {
        vehicleCode: 'VH-09', // 1 200 kg
        deliveryDate: inDays(5),
      });
      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        status: 'DRAFT',
        createdBy: 'diane',
        totalWeightKg: 0,
        salesOrders: [],
      });
      expect(response.body.no).toMatch(/^TO-\d{4}$/);
      no = response.body.no;
    });

    it('adds several sales orders at once and plans them', async () => {
      // 430 + 260 + 145.50 = 835.50 kg
      const response = await diane().post(`/transport-orders/${no}/lines`, {
        salesOrderNos: ['SO-1008', 'SO-1011', 'SO-1013'],
      });
      expect(response.status).toBe(200);
      expect(response.body.totalWeightKg).toBe(835.5);
      expect(
        response.body.salesOrders.map((s: { status: string }) => s.status),
      ).toEqual(['PLANNED', 'PLANNED', 'PLANNED']);
      expect(await salesOrderStatus('SO-1008')).toBeUndefined();
      version = response.body.version;
    });

    it('refuses to exceed the vehicle capacity and changes nothing', async () => {
      // 835.50 + 520 > 1 200
      const response = await diane().post(`/transport-orders/${no}/lines`, {
        salesOrderNos: ['SO-1040', 'SO-1020'],
      });
      expect(response.status).toBe(422);
      expect(response.body).toMatchObject({
        code: 'CAPACITY_EXCEEDED',
        details: {
          capacityKg: 1200,
          currentWeightKg: 835.5,
          addedWeightKg: 605,
        },
      });
      expect(await salesOrderStatus('SO-1040')).toBe('TO_PLAN');
    });

    it('refuses a sales order that is already planned', async () => {
      const response = await diane().post(`/transport-orders/${no}/lines`, {
        salesOrderNos: ['SO-1006'],
      });
      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({
        code: 'SALES_ORDER_NOT_AVAILABLE',
        details: { salesOrderNos: ['SO-1006'] },
      });
    });

    it('removes a sales order and puts it back to plan', async () => {
      const response = await diane()
        .delete(`/transport-orders/${no}/lines/SO-1013`)
        .set('If-Match', version);
      expect(response.status).toBe(200);
      expect(response.body.totalWeightKg).toBe(690);
      expect(await salesOrderStatus('SO-1013')).toBe('TO_PLAN');
      expect(response.body.version).not.toBe(version);
    });

    it('refuses an action based on a stale version', async () => {
      const response = await eric()
        .post(`/transport-orders/${no}/validate`)
        .set('If-Match', version);
      expect(response.status).toBe(409);
      expect(response.body.code).toBe('STALE_TRANSPORT_ORDER');
    });

    it('forbids a dispatcher from validating', async () => {
      const response = await diane().post(`/transport-orders/${no}/validate`);
      expect(response.status).toBe(403);
      expect(response.body.code).toBe('ROLE_NOT_ALLOWED');
    });

    it('lets a logistics manager validate', async () => {
      const response = await eric().post(`/transport-orders/${no}/validate`);
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'VALIDATED',
        validatedBy: 'eric',
      });
    });

    it('locks a validated order', async () => {
      const add = await diane().post(`/transport-orders/${no}/lines`, {
        salesOrderNos: ['SO-1013'],
      });
      const remove = await diane().delete(
        `/transport-orders/${no}/lines/SO-1008`,
      );
      expect([add.status, remove.status]).toEqual([409, 409]);
      expect(add.body.code).toBe('TRANSPORT_ORDER_NOT_DRAFT');
    });

    it('marks the order as departed and its sales orders as in delivery', async () => {
      const response = await diane().post(`/transport-orders/${no}/depart`);
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('DEPARTED');
      expect(
        response.body.salesOrders.map((s: { status: string }) => s.status),
      ).toEqual(['IN_DELIVERY', 'IN_DELIVERY']);
    });

    it('refuses to depart twice', async () => {
      const response = await diane().post(`/transport-orders/${no}/depart`);
      expect(response.status).toBe(409);
      expect(response.body.code).toBe('INVALID_STATUS_TRANSITION');
    });
  });

  describe('other transitions', () => {
    it('refuses to validate an empty order', async () => {
      const response = await eric().post('/transport-orders/TO-0004/validate');
      expect(response.status).toBe(422);
      expect(response.body.code).toBe('TRANSPORT_ORDER_EMPTY');
    });

    it('refuses to depart a draft order', async () => {
      const response = await diane().post('/transport-orders/TO-0003/depart');
      expect(response.status).toBe(409);
    });

    it('assigns a sales order to a single order under concurrent requests', async () => {
      const [first, second] = await Promise.all([
        diane().post('/transport-orders', {
          vehicleCode: 'VH-06',
          deliveryDate: inDays(6),
        }),
        diane().post('/transport-orders', {
          vehicleCode: 'VH-08',
          deliveryDate: inDays(6),
        }),
      ]);
      const responses = await Promise.all([
        diane().post(`/transport-orders/${first.body.no}/lines`, {
          salesOrderNos: ['SO-1023'],
        }),
        eric().post(`/transport-orders/${second.body.no}/lines`, {
          salesOrderNos: ['SO-1023'],
        }),
      ]);
      expect(responses.map((r) => r.status).sort((a, b) => a - b)).toEqual([
        200, 409,
      ]);
    });
  });
});
