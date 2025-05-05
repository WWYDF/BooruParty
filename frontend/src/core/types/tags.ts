// export type Tag = {
//   id: number;
//   name: string;
//   description: string;
//   category: {
//     id: number;
//     name: string;
//     color: string;
//     order: number;
//     updatedAt: Date;
//   };
//   aliases: {
//     id: number;
//     alias: string
//     tagId: number;
//   }[];
//   implications: {
//     id: number;
//     name: string;
//     description: string;
//     category: {
//       id: number;
//       name: string;
//       color: string;
//       order: number;
//       updatedAt: Date;
//     }
//   }[];
//   suggestions: {
//     id: number;
//     name: string;
//     description: string;
//     category: {
//       id: number;
//       name: string;
//       color: string;
//       order: number;
//       updatedAt: Date;
//     }
//   }[];
// };

export type Tag = {
  id: number;
  name: string;
  description?: string;
  category: {
    id: number;
    name: string;
    color: string;
    order?: number;
  };
  aliases?: { id: number; alias: string }[];
  suggestions?: Tag[];
  implications?: Tag[];
  allImplications?: Tag[];
};