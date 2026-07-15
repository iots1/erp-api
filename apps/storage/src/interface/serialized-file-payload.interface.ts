/**
 * A file object as it arrives over the microservice transport (TCP/RabbitMQ),
 * where `Buffer` has been serialized to its JSON form.
 */
export interface ISerializedFilePayload {
  originalname: string;
  mimetype: string;
  buffer: {
    type: 'Buffer';
    data: number[];
  };
}
