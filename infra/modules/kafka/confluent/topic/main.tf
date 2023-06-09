

resource "confluent_kafka_topic" "topic" {
  topic_name       = var.topic_name
  partitions_count = var.partitions

  config = merge(
    {
      "cleanup.policy"      = var.is_compact ? "compact" : "delete",
      # "replication.factor"  = var.replication_factor
      "min.insync.replicas" = var.replication_factor > 1 ? 2 : 1
    },
    var.config,
  )
}

resource "confluent_schema" "key_schema" {

  subject_name = "${var.topic_name}-key"
  format       = "AVRO"
  schema       = var.key_schema
}

resource "confluent_schema" "value_schema" {
  subject_name = "${var.topic_name}-value"
  format       = "AVRO"
  schema       = var.value_schema
}

resource "confluent_subject_config" "key_schema_compatability" {
  subject_name        = split("/", confluent_schema.key_schema.id)[1]
  compatibility_level = var.key_schema_compatability
}

resource "confluent_subject_config" "value_schema_compatability" {
  subject_name        = split("/", confluent_schema.value_schema.id)[1]
  compatibility_level = var.value_schema_compatability
}
