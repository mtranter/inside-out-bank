import { DynamoDB } from "@aws-sdk/client-dynamodb";
import { DynamoObject, tableBuilder } from "funamots";
import { TxOutboxMessage } from "dynamodb-kafka-outbox/dist/tx-outbox";
import { Product } from "./../models";
import { attributeNotExists } from "funamots/dist/lib/conditions";

type EventDto = {
  hk: string;
  sk: string;
  category?: string;
  subCategory?: string;
} & TxOutboxMessage;

type ProductDto = {
  hk: string;
  sk: string;
  category: string;
  subCategory: string;
  data: Product;
};

export type Dto = ProductDto | EventDto;

const base64EncodeObject = (o: DynamoObject) => {
  return Buffer.from(JSON.stringify(o)).toString("base64");
};

const decodeBase64Object = (s: string): DynamoObject => {
  return JSON.parse(Buffer.from(s, "base64").toString("utf-8"));
};

export const buildTable = (tableName: string, client?: DynamoDB) =>
  tableBuilder<Dto>(tableName)
    .withKey("hk", "sk")
    .withGlobalIndex("gsi1", "category", "hk")
    .withGlobalIndex("gsi2", "subCategory", "hk")
    .withGlobalIndex("gsi3", "sk", "hk")
    .build({ client: client ?? new DynamoDB({}) });

export type ProductRepo = {
  get: (sku: string) => Promise<Product | undefined>;
  put: (product: Product, event: TxOutboxMessage) => Promise<Product>;
  delete: (sku: string, event: TxOutboxMessage) => Promise<void>;
  listProducts: (args?: {
    nextToken?: string;
    pageSize?: number;
  }) => Promise<{ products: Product[]; nextToken?: string }>;
  listProductByCategory: (
    categoryId: string,
    args?: { nextToken?: string; pageSize?: number }
  ) => Promise<{ products: Product[]; nextToken?: string }>;
  listProductBySubCategory: (
    subCategoryId: string,
    args?: { nextToken?: string; pageSize?: number }
  ) => Promise<{ products: Product[]; nextToken?: string }>;
};

export const ProductRepo = ({
  tableName,
  client,
}: {
  tableName: string;
  client?: DynamoDB;
}): ProductRepo => {
  const productsTable = buildTable(tableName, client);
  return {
    get: async (sku: string) => {
      const product = await productsTable.get<ProductDto>({
        hk: `PRODUCT#${sku}`,
        sk: "#PRODUCT#",
      });
      return product?.data;
    },
    listProducts: async (args) => {
      const startKey = args?.nextToken
        ? decodeBase64Object(args?.nextToken)
        : undefined;
      const result = await productsTable.indexes.gsi3.query<ProductDto>(
        "#PRODUCT#",
        {
          startKey,
          pageSize: args?.pageSize ?? 20,
        }
      );
      return {
        products: result.records.map((i) => i.data),
        nextToken: result.nextStartKey
          ? base64EncodeObject(result.nextStartKey)
          : undefined,
      };
    },
    put: async (product: Product, event: TxOutboxMessage) => {
      await productsTable.transactPut([
        {
          item: {
            hk: `PRODUCT#${product.sku}`,
            sk: "#PRODUCT#",
            category: product.categoryId,
            subCategory: product.subCategory,
            data: product,
          },
          conditionExpression: {
            hk: attributeNotExists(),
          },
        },
        {
          item: {
            hk: `EVENT#${product.sku}`,
            sk: `#EVENT#${Date.now()}`,
            ...event,
          },
        },
      ]);
      return product;
    },
    delete: async (sku: string, event: TxOutboxMessage) => {
      await productsTable.transactWrite({
        deletes: [{ item: { hk: `PRODUCT#${sku}`, sk: "#PRODUCT#" } }],
        puts: [
          {
            item: { hk: `EVENT#${sku}`, sk: `#EVENT#${Date.now()}`, ...event },
          },
        ],
      });
    },
    listProductByCategory: async (categoryId, args) => {
      const startKey = args?.nextToken
        ? decodeBase64Object(args?.nextToken)
        : undefined;
      const result = await productsTable.indexes.gsi1.query<ProductDto>(
        categoryId,
        {
          startKey,
          pageSize: args?.pageSize ?? 20,
        }
      );
      return {
        products: result.records.map((i) => i.data),
        nextToken: result.nextStartKey
          ? base64EncodeObject(result.nextStartKey)
          : undefined,
      };
    },
    listProductBySubCategory: async (subCategoryId, args) => {
      const startKey = args?.nextToken
        ? decodeBase64Object(args?.nextToken)
        : undefined;
      const result = await productsTable.indexes.gsi2.query<ProductDto>(
        subCategoryId,
        {
          startKey,
          pageSize: args?.pageSize ?? 20,
        }
      );
      return {
        products: result.records.map((i) => i.data),
        nextToken: result.nextStartKey
          ? base64EncodeObject(result.nextStartKey)
          : undefined,
      };
    },
  };
};
