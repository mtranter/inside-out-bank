import { DynamoDB } from "@aws-sdk/client-dynamodb";
import { ProductRepo, buildTable } from "./repo";
import { buildTestProduct } from "../../test/models/utils";

const dynamoDB = new DynamoDB({
  region: "local-env",
  endpoint: "http://localhost:9011",
  credentials: {
    accessKeyId: "accessKeyId",
    secretAccessKey: "secretAccessKey",
  },
});

describe("DynamoDB Repo Spec", () => {
  const table = buildTable("products", dynamoDB);
  beforeEach(async () => {
    await table.deleteTable().catch(() => {
      // ignore
    });
    await table.createTable({
      billingMode: "PAY_PER_REQUEST",
      keyDefinitions: {
        hk: "S",
        sk: "S",
        category: "S",
        subCategory: "S",
      },
    });
  });
  const sut = ProductRepo({ tableName: "products", client: dynamoDB });
  it("should create and read products", async () => {
    const putProduct = buildTestProduct();
    await sut.put(putProduct, {
      topic: "",
      key: "k",
      value: "v",
      isTxOutboxEvent: true,
    });
    const result = await sut.get(putProduct.sku);
    expect(result).toEqual(putProduct);
    const results = await table.scan();
    expect(results.records.length).toEqual(2);
    const readProduct = await sut.get(putProduct.sku);
    expect(readProduct).toEqual(putProduct);

    const productsByCategory = await sut.listProductByCategory(
      putProduct.categoryId
    );
    expect(productsByCategory.products.length).toEqual(1);
    expect(productsByCategory.products[0]).toEqual(putProduct);

    const productsBySubcategory = await sut.listProductBySubCategory(
      putProduct.subCategory
    );
    expect(productsBySubcategory.products.length).toEqual(1);
    expect(productsBySubcategory.products[0]).toEqual(putProduct);
  });
  it("should page through products by category", async () => {
    const randomString = () => Math.random().toString(36).substring(7);
    for (let i = 0; i < 150; i++) {
      const putProduct = buildTestProduct();
      putProduct.sku = randomString();
      putProduct.categoryId = "cat1";
      putProduct.subCategory = "subcat1";
      await sut.put(putProduct, {
        topic: "",
        key: `k`,
        value: "v",
        isTxOutboxEvent: true,
      });
    }
    const productsByCategory = await sut.listProductByCategory("cat1", {
      pageSize: 20,
    });
    expect(productsByCategory.products.length).toEqual(20);
    expect(productsByCategory.nextToken).toBeDefined();
    const productsByCategory2 = await sut.listProductByCategory("cat1", {
      nextToken: productsByCategory.nextToken,
      pageSize: 30,
    });
    expect(productsByCategory2.products.length).toEqual(30);
  });
  it("should page through products by subCategory", async () => {
    const randomString = () => Math.random().toString(36).substring(7);
    for (let i = 0; i < 150; i++) {
      const putProduct = buildTestProduct();
      putProduct.sku = randomString();
      putProduct.categoryId = "cat1";
      putProduct.subCategory = "subcat1";
      await sut.put(putProduct, {
        topic: "",
        key: `k`,
        value: "v",
        isTxOutboxEvent: true,
      });
    }
    const productsByCategory = await sut.listProductBySubCategory("subcat1", {
      pageSize: 25,
    });
    expect(productsByCategory.products.length).toEqual(25);
    expect(productsByCategory.nextToken).toBeDefined();
    const productsByCategory2 = await sut.listProductBySubCategory("subcat1", {
      nextToken: productsByCategory.nextToken,
      pageSize: 31,
    });
    expect(productsByCategory2.products.length).toEqual(31);
  });
  it("should delete product and persist event", async () => {
    const putProduct = buildTestProduct();
    await sut.put(putProduct, {
      topic: "",
      key: "k",
      value: "v",
      isTxOutboxEvent: true,
    });
    const result = await sut.get(putProduct.sku);
    expect(result).toEqual(putProduct);
    const results = await table.scan();
    expect(results.records.length).toEqual(2);
    await sut.delete(putProduct.sku, {
      topic: "",
      key: "k",
      value: "v",
      isTxOutboxEvent: true,
    });
    const results2 = await table.scan();
    expect(results2.records.length).toEqual(2);
    const result2 = await sut.get(putProduct.sku);
    expect(result2).toBeUndefined();
    const event1 = results2.records[0];
    expect(event1).toBeDefined();
    expect(event1.hk).toEqual(`EVENT#${putProduct.sku}`);
    const event2 = results2.records[1];
    expect(event2).toBeDefined();
    expect(event2.hk).toEqual(`EVENT#${putProduct.sku}`);
  });
});
