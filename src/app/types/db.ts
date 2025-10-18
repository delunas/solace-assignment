export type Advocate = {
    id: number;
    firstName: string;
    lastName: string;
    city: string;
    degree: string;
    specialties: string[] | unknown;
    yearsOfExperience: number;
    phoneNumber: number;
    createdAt: Date | null;
};