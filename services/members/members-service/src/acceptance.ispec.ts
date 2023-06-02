import { SSM } from "@aws-sdk/client-ssm";
import { CreateMemberSchema, Member } from "./schema";
import { generateMock } from "@anatine/zod-mock";
import { Consumer, Kafka } from "kafkajs";
import { SchemaRegistry } from "@kafkajs/confluent-schema-registry";
import { KafkaPayload } from "@inside-out-bank/models";
import waitForExpect from "../../../../node_modules/wait-for-expect/lib/index.d";

jest.setTimeout(10000);
const ssm = new SSM({
  region: "ap-southeast-2",
});

const getSSMValue = async (name: string) =>
  await ssm
    .getParameter({
      Name: name,
      WithDecryption: true,
    })
    .then((r) => r.Parameter?.Value!);

const makeAuthedRequest = async (
  url: string,
  method: string,
  data?: unknown | undefined
) => {
  const jwtEndpoint =
    "https://inside-out-bank-prod.auth.ap-southeast-2.amazoncognito.com/oauth2/token";
  const clientIdP = getSSMValue(
    `/inside-out-bank/cognito/prod/members_service_test_client_id`
  );
  const clientSecretP = getSSMValue(
    `/inside-out-bank/cognito/prod/members_service_test_client_secret`
  );
  const clientId = await clientIdP;
  const clientSecret = await clientSecretP;
  const token = (await fetch(jwtEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      authorization:
        "Basic " +
        Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
    },
    body: `grant_type=client_credentials&client_id=${clientId}&scope=https://members.inside-out-bank.com/api.execute`,
  })
    .then((r) => r.json())
    .catch((e) => {
      console.error(e);
      throw e;
    })) as { access_token: string };
  const idToken = token.access_token;
  return await fetch(
    "https://84t0e5o34j.execute-api.ap-southeast-2.amazonaws.com/live/healthcheck",
    {
      headers: {
        Authorization: `Bearer ${idToken}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: data ? JSON.stringify(data) : undefined,
    }
  );
};

const setupKafkaConsumer = async () => {
  const kafkaConfig = JSON.parse(
    await getSSMValue("/inside-out-bank/members-service/test-user/kafka-config")
  ) as { brokers: string; username: string; password: string };
  const schemaRegistryConfig = JSON.parse(
    await getSSMValue(
      "/inside-out-bank/members-service/test-user/schema-registry-config"
    )
  ) as { host: string; username: string; password: string };

  const consumer = new Kafka({
    clientId: "members-service",
    brokers: kafkaConfig.brokers.split(","),
    ssl: true,
    sasl: {
      mechanism: "plain",
      username: kafkaConfig.username,
      password: kafkaConfig.password,
    },
  }).consumer({ groupId: "members-service-tester" });
  const schemaRegistry = new SchemaRegistry({
    host: schemaRegistryConfig.host,
    auth: {
      username: schemaRegistryConfig.username,
      password: schemaRegistryConfig.password,
    },
  });
  await consumer.connect();
  await consumer.subscribe({
    topic: "com.insideoutbank.members.MemberData",
    fromBeginning: false,
  });
  const messages: unknown[] = [];
  const runPromise = consumer.run({
    autoCommit: true,
    eachMessage: async ({ message }) => {
      const response = await schemaRegistry.decode(message.value!);
      messages.push(response);
    },
  });
  return { consumer, messages, runPromise };
};

describe("Members API", () => {
  describe("healthcheck endpoint", () => {
    it("should return 200", async () => {
      const response = await makeAuthedRequest(
        "https://84t0e5o34j.execute-api.ap-southeast-2.amazonaws.com/live/healthcheck",
        "GET"
      );
      expect(response.status).toEqual(200);
    });
  });
  describe("create member endpoint", () => {
    const user = generateMock(CreateMemberSchema);
    let response: Response;
    let consumer: Consumer;
    let kafkaMessages: unknown[];
    beforeAll(async () => {
      await setupKafkaConsumer();
      response = await makeAuthedRequest(
        "https://84t0e5o34j.execute-api.ap-southeast-2.amazonaws.com/live/members",
        "POST",
        user
      );
    });
    it("should return 200", () => {
      expect(response.status).toEqual(201);
    });
    it("should have returned a member", async () => {
      const member = await response.json();
      expect(member).toMatchObject(user);
    });
    it("should have persisted member for API query", async () => {
      const returnedMember = (await response.json()) as Member;
      const getResponse = await makeAuthedRequest(
        `https://84t0e5o34j.execute-api.ap-southeast-2.amazonaws.com/live/members/${returnedMember.id}`,
        "GET"
      );
      const fetchedMember = await getResponse.json();
      expect(fetchedMember).toEqual(returnedMember);
    });
    it("Should have published member created event to kafka", async () => {
      const returnedMember = (await response.json()) as Member;
      const findMember = () => {
        return kafkaMessages.find((e) => {
          const event = e as KafkaPayload;
          const payload = event.payload as Member;
          if (payload) {
            return payload.id === returnedMember.id;
          } else {
            return false;
          }
        });
      };
      waitForExpect(() => {
        const member = findMember();
        expect(member).toBeDefined();
      });
    });
  });
});